<template>
  <div class="page">
    <div class="page-header">
      <h2>{{ t('nav.templates') }}</h2>
      <button class="btn-primary" @click="openUpload">{{ t('template.upload') }}</button>
    </div>

    <div v-if="loading" class="loading">{{ t('error.loading') }}</div>

    <div v-else-if="templates.length === 0" class="empty">{{ t('template.list.empty') }}</div>

    <div v-else class="template-list">
      <div v-for="name in templates" :key="name" class="template-card">
        <div class="template-card-header">
          <span class="template-name">{{ name }}</span>
        </div>
        <div class="template-card-meta">
          <button class="btn-ghost-sm" @click="showDetail(name)">{{ t('action.edit') }}</button>
          <button class="btn-ghost-sm danger" @click="handleDelete(name)">{{ t('action.delete') }}</button>
        </div>
      </div>
    </div>

    <!-- Upload dialog -->
    <dialog ref="uploadDialog" class="modal modal-wide">
      <div class="modal-header">
        <h3>{{ t('template.upload') }}</h3>
        <button class="btn-ghost" @click="closeUpload">✕</button>
      </div>

      <div v-if="step === 'select'" class="upload-drop-zone" @dragover.prevent @drop.prevent="onDrop">
        <input ref="fileInput" type="file" accept=".csv,.txt" hidden @change="onFileChange" />
        <p>{{ t('template.upload.hint') }}</p>
        <button class="btn-primary" @click="fileInput.click()">CSV wählen</button>
      </div>

      <div v-else-if="step === 'preview'">
        <div class="preview-meta">
          <div class="field">
            <label>{{ t('template.name') }}</label>
            <input v-model="importName" type="text" required />
          </div>
          <div class="preview-stats">
            <span>{{ t('csv.preview.channels', { count: previewChannels.length }) }}</span>
          </div>
        </div>

        <div class="channel-table-wrapper">
          <table class="channel-table preview-table">
            <thead>
              <tr>
                <th>{{ t('field.channel') }}</th>
                <th>{{ t('field.address') }}</th>
                <th>{{ t('field.device') }}</th>
                <th>{{ t('field.position') }}</th>
                <th>{{ t('field.color') }}</th>
                <th>{{ t('field.notes') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ch in previewChannels.slice(0, 20)" :key="ch.channel">
                <td>{{ ch.channel }}</td>
                <td>{{ ch.address }}</td>
                <td>{{ ch.device }}</td>
                <td>{{ ch.position }}</td>
                <td>{{ ch.color }}</td>
                <td>{{ ch.notes }}</td>
              </tr>
              <tr v-if="previewChannels.length > 20">
                <td colspan="6" class="muted">… {{ previewChannels.length - 20 }} weitere Kanäle</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="modal-footer">
          <span v-if="importError" class="error-msg" style="flex:1">{{ importError }}</span>
          <button class="btn-ghost" @click="step = 'select'">{{ t('action.back') }}</button>
          <button class="btn-primary" :disabled="importing || !importName.trim()" @click="handleImport">
            {{ importing ? '…' : t('template.upload.confirm') }}
          </button>
        </div>
      </div>

      <div v-else-if="step === 'done'" class="import-success">
        <p>✓ {{ t('template.upload.success') }}</p>
        <button class="btn-primary" @click="closeUpload">{{ t('action.close') }}</button>
      </div>
    </dialog>

    <!-- Detail dialog -->
    <dialog ref="detailDialog" class="modal modal-wide">
      <div class="modal-header">
        <h3>{{ detailName }}</h3>
        <button class="btn-ghost" @click="detailDialog.close()">✕</button>
      </div>

      <div v-if="detailLoading" class="loading">{{ t('error.loading') }}</div>

      <template v-else>
        <div class="tab-bar">
          <button :class="['tab-btn', { active: activeTab === 'channels' }]" @click="activeTab = 'channels'">{{ t('show.channels') }}</button>
          <button :class="['tab-btn', { active: activeTab === 'sections' }]" @click="activeTab = 'sections'">Abschnitte</button>
        </div>

        <div v-show="activeTab === 'channels'" class="channel-table-wrapper">
        <table class="channel-table">
          <thead>
            <tr>
              <th class="col-channel">{{ t('field.channel') }}</th>
              <th class="col-address">{{ t('field.address') }}</th>
              <th class="col-device">{{ t('field.device') }}</th>
              <th class="col-position">{{ t('field.position') }}</th>
              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody v-for="group in groupedChannels" :key="group.position">
            <tr class="category-header-row">
              <td colspan="5">
                <span class="category-name">{{ group.position || t('channel.no_category') }}</span>
                <span class="category-count">{{ group.channels.length }}</span>
              </td>
            </tr>
            <tr v-for="ch in group.channels" :key="ch.channel" @click="startEdit(ch)">
              <td class="col-channel">
                <input v-if="editingChannel === ch.channel" class="inline-input" v-model="editForm.channel" @click.stop />
                <template v-else>{{ ch.channel }}</template>
              </td>
              <td class="col-address">
                <input v-if="editingChannel === ch.channel" class="inline-input" v-model="editForm.address" @click.stop />
                <template v-else>{{ ch.address }}</template>
              </td>
              <td class="col-device">
                <input v-if="editingChannel === ch.channel" class="inline-input inline-input-wide" v-model="editForm.device" @click.stop />
                <template v-else>{{ ch.device }}</template>
              </td>
              <td class="col-position">
                <input v-if="editingChannel === ch.channel" class="inline-input" v-model="editForm.position" @click.stop />
                <template v-else>{{ ch.position }}</template>
              </td>
              <td class="col-actions" @click.stop>
                <template v-if="editingChannel === ch.channel">
                  <button class="btn-ghost-sm" @click="saveEdit(ch)">✓</button>
                  <button class="btn-ghost-sm" @click="cancelEdit">✕</button>
                </template>
                <button v-else class="btn-ghost-sm danger" @click.stop="deleteChannel(ch)">✕</button>
              </td>
            </tr>
            <tr class="add-row-trigger">
              <td colspan="5">
                <button type="button" class="btn-ghost-sm" @click.stop="startAdd(group.position)">+ {{ t('channel.add') }}</button>
              </td>
            </tr>
            <tr v-if="addingToPosition === group.position" class="add-row-form">
              <td><input class="inline-input" v-model="addForm.channel" placeholder="Nr." @click.stop /></td>
              <td><input class="inline-input" v-model="addForm.address" placeholder="1/001" @click.stop /></td>
              <td><input class="inline-input inline-input-wide" v-model="addForm.device" @click.stop /></td>
              <td><input class="inline-input" v-model="addForm.position" @click.stop /></td>
              <td @click.stop>
                <div class="add-row-actions">
                  <button class="btn-ghost-sm" @click="confirmAdd">✓</button>
                  <button class="btn-ghost-sm" @click="cancelAdd">✕</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        </div>

        <!-- Sections editor -->
        <div v-show="activeTab === 'sections'" class="sections-editor">
          <div v-for="(sec, idx) in templateSections" :key="sec.id" class="section-card">
            <div class="section-card-header">
              <div class="section-reorder">
                <button class="btn-ghost-sm" :disabled="idx === 0" @click="moveSection(idx, -1)">↑</button>
                <button class="btn-ghost-sm" :disabled="idx === templateSections.length - 1" @click="moveSection(idx, 1)">↓</button>
              </div>
              <input :value="sec.title" placeholder="Titel" @input="sec.title = $event.target.value" @change="persistSections" />
              <select class="section-type-select"
                :value="sec.type"
                @change="onTypeChange(sec, $event.target.value)"
              >
                <option value="markdown">Markdown</option>
                <option value="fields" :disabled="hasFieldsType() && sec.type !== 'fields'">Felder</option>
              </select>
              <button class="btn-ghost-sm danger" @click="deleteSection(idx)">✕</button>
            </div>
            <div v-if="sec.type === 'fields'" class="fields-editor">
              <div v-for="(field, fidx) in sec.fields" :key="field.key" class="fields-editor-row">
                <input :value="field.label" placeholder="Label" @input="field.label = $event.target.value" @change="persistSections" />
                <input :value="field.unit" placeholder="Einheit" style="max-width:100px" @input="field.unit = $event.target.value" @change="persistSections" />
                <button class="btn-ghost-sm danger" @click="deleteField(sec, fidx)">✕</button>
              </div>
              <button class="btn-ghost-sm" @click="addField(sec)">+ Feld</button>
            </div>
          </div>
          <button class="btn-ghost-sm" @click="addSection">+ Abschnitt</button>
        </div>
      </template>

      <div class="modal-footer">
        <span v-if="detailSaving || sectionsSaving" class="saving-hint">…</span>
        <button class="btn-ghost" @click="detailDialog.close()">{{ t('action.close') }}</button>
      </div>
    </dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useLocale } from '../composables/useLocale.js'
import { fetchTemplates, fetchTemplateChannels, saveTemplate, uploadTemplate, deleteTemplate } from '../api/templates.js'
import { parseCsv } from '../api/channels.js'
import { fetchTemplateSections, saveTemplateSections } from '../api/sections.js'

const { t } = useLocale()

const templates = ref([])
const loading = ref(true)

const uploadDialog = ref(null)
const fileInput = ref(null)
const step = ref('select')
const csvText = ref('')
const importName = ref('')
const previewChannels = ref([])
const importing = ref(false)
const importError = ref('')

const detailDialog = ref(null)
const detailName = ref('')
const detailChannels = ref([])
const detailLoading = ref(false)
const detailSaving = ref(false)

const activeTab = ref('channels')
const templateSections = ref([])
const sectionsSaving = ref(false)

const editingChannel = ref(null)
const editForm = ref({})
const addingToPosition = ref(null)
const addForm = ref({})

const groupedChannels = computed(() => {
  const sorted = [...detailChannels.value].sort((a, b) => Number(a.channel) - Number(b.channel))
  const groups = {}
  for (const ch of sorted) {
    const pos = ch.position || ''
    if (!groups[pos]) groups[pos] = []
    groups[pos].push(ch)
  }
  return Object.entries(groups).map(([position, channels]) => ({ position, channels }))
})

onMounted(async () => {
  templates.value = await fetchTemplates()
  loading.value = false
})

// ── Upload ─────────────────────────────────────────────────────────────────

function openUpload() {
  step.value = 'select'
  csvText.value = ''
  importName.value = ''
  previewChannels.value = []
  importError.value = ''
  uploadDialog.value.showModal()
}

function closeUpload() {
  uploadDialog.value.close()
  step.value = 'select'
}

function onFileChange(e) {
  const file = e.target.files[0]
  if (file) processFile(file)
}

function onDrop(e) {
  const file = e.dataTransfer.files[0]
  if (file) processFile(file)
}

function processFile(file) {
  importName.value = file.name.replace(/\.csv$/i, '')
  const reader = new FileReader()
  reader.onload = (e) => {
    csvText.value = e.target.result
    previewChannels.value = parseCsv(csvText.value)
    step.value = 'preview'
  }
  reader.readAsText(file, 'utf-8')
}

async function handleImport() {
  importing.value = true
  importError.value = ''
  try {
    const name = importName.value.trim()
    const filename = name.endsWith('.csv') ? name : name + '.csv'
    await uploadTemplate({ name: filename, text: csvText.value })
    templates.value = await fetchTemplates()
    step.value = 'done'
  } catch (e) {
    importError.value = e?.message || 'Fehler beim Import'
  } finally {
    importing.value = false
  }
}

// ── Detail / Edit ──────────────────────────────────────────────────────────

async function showDetail(name) {
  detailName.value = name
  detailLoading.value = true
  activeTab.value = 'channels'
  editingChannel.value = null
  addingToPosition.value = null
  detailDialog.value.showModal()
  const [channels, sections] = await Promise.all([
    fetchTemplateChannels(name),
    fetchTemplateSections(name),
  ])
  detailChannels.value = channels
  templateSections.value = Array.isArray(sections) ? sections : (sections?.sections ?? [])
  detailLoading.value = false
}

async function persist() {
  detailSaving.value = true
  await saveTemplate(detailName.value, detailChannels.value)
  detailSaving.value = false
}

async function persistSections() {
  sectionsSaving.value = true
  await saveTemplateSections(detailName.value, templateSections.value)
  sectionsSaving.value = false
}

function addSection() {
  templateSections.value.push({
    id: crypto.randomUUID(),
    title: '',
    type: 'markdown',
    order: templateSections.value.length,
    fields: []
  })
  persistSections()
}

function deleteSection(idx) {
  templateSections.value.splice(idx, 1)
  templateSections.value.forEach((s, i) => s.order = i)
  persistSections()
}

function moveSection(idx, dir) {
  const arr = templateSections.value
  const swap = idx + dir
  if (swap < 0 || swap >= arr.length) return
  ;[arr[idx], arr[swap]] = [arr[swap], arr[idx]]
  arr.forEach((s, i) => s.order = i)
  persistSections()
}

function addField(section) {
  section.fields.push({ key: crypto.randomUUID().slice(0, 8), label: '', unit: '' })
  persistSections()
}

function deleteField(section, idx) {
  section.fields.splice(idx, 1)
  persistSections()
}

function hasFieldsType() {
  return templateSections.value.some(s => s.type === 'fields')
}

function onTypeChange(section, newType) {
  if (newType === 'fields' && hasFieldsType() && section.type !== 'fields') return
  section.type = newType
  if (newType === 'fields' && !section.fields) section.fields = []
  persistSections()
}

function startEdit(ch) {
  editingChannel.value = ch.channel
  editForm.value = { ...ch }
  addingToPosition.value = null
}

function cancelEdit() {
  editingChannel.value = null
}

async function saveEdit(ch) {
  Object.assign(ch, editForm.value)
  editingChannel.value = null
  await persist()
}

async function deleteChannel(ch) {
  detailChannels.value = detailChannels.value.filter(c => c.channel !== ch.channel)
  await persist()
}

function startAdd(position) {
  addingToPosition.value = position
  addForm.value = { channel: '', address: '', device: '', position, color: '', notes: '' }
  editingChannel.value = null
}

function cancelAdd() {
  addingToPosition.value = null
}

async function confirmAdd() {
  if (!addForm.value.channel.trim()) return
  detailChannels.value.push({ ...addForm.value })
  addingToPosition.value = null
  await persist()
}

async function handleDelete(name) {
  if (!window.confirm(`Vorlage „${name}" löschen?`)) return
  await deleteTemplate(name)
  templates.value = templates.value.filter(n => n !== name)
}
</script>
