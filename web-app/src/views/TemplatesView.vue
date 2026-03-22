<template>
  <div class="px-4 py-10 sm:px-6 lg:px-8">
    <!-- Page header -->
    <div class="sm:flex sm:items-center mb-8">
      <div class="sm:flex-auto">
        <h1 class="text-base font-semibold text-white">{{ t('nav.templates') }}</h1>
      </div>
      <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
        <button
          type="button"
          class="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          @click="openUpload"
        >
          {{ t('template.upload') }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="text-sm text-gray-400">…</div>
    <div v-else-if="templates.length === 0" class="text-sm text-gray-400">{{ t('template.list.empty') }}</div>

    <ul v-else role="list" class="divide-y divide-white/10">
      <li
        v-for="name in templates"
        :key="name"
        class="flex items-center justify-between gap-x-6 py-5"
      >
        <div class="min-w-0">
          <p class="text-sm/6 font-semibold text-white">{{ templateDisplayName(name) || name }}</p>
        </div>
        <div class="flex flex-none items-center gap-x-4">
          <button
            type="button"
            class="rounded-md px-2.5 py-1.5 text-sm font-semibold text-white ring-1 ring-white/10 hover:ring-white/20"
            @click="showDetail(name)"
          >
            {{ t('action.edit') }}
          </button>
          <button
            type="button"
            class="rounded-md px-2.5 py-1.5 text-sm font-semibold text-red-400 ring-1 ring-white/10 hover:ring-red-400/50"
            @click="handleDelete(name)"
          >
            {{ t('action.delete') }}
          </button>
        </div>
      </li>
    </ul>

    <!-- Upload dialog -->
    <dialog ref="uploadDialog" class="m-auto w-full max-w-3xl rounded-xl bg-gray-900 ring-1 ring-white/10 shadow-2xl p-0 backdrop:bg-black/50">
      <div class="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <h3 class="text-base font-semibold text-white">{{ t('template.upload') }}</h3>
        <button class="rounded-md px-3 py-2 text-sm font-semibold text-gray-400 ring-1 ring-white/10 hover:ring-white/20" @click="closeUpload">✕</button>
      </div>

      <div v-if="step === 'select'" class="border-2 border-dashed border-white/20 rounded-lg p-8 text-center m-6" @dragover.prevent @drop.prevent="onDrop">
        <input ref="fileInput" type="file" accept=".csv,.txt" hidden @change="onFileChange" />
        <p class="text-sm text-gray-400 mb-4">{{ t('template.upload.hint') }}</p>
        <button class="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50" @click="fileInput?.click()">{{ t('template.csv.choose') }}</button>
      </div>

      <div v-else-if="step === 'preview'" class="px-6 pt-4">
        <div class="text-sm text-gray-400 mb-4">
          <div class="field mb-2">
            <label class="block text-xs text-gray-400 mb-1">{{ t('template.name') }}</label>
            <input v-model="importName" type="text" required class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent" />
          </div>
          <div class="preview-stats">
            <span>{{ t('csv.preview.channels', { count: previewChannels.length }) }}</span>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-400 border-b border-white/10">{{ t('field.channel') }}</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-400 border-b border-white/10">{{ t('field.address') }}</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-400 border-b border-white/10">{{ t('field.device') }}</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-400 border-b border-white/10">{{ t('field.position') }}</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-400 border-b border-white/10">{{ t('field.color') }}</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-400 border-b border-white/10">{{ t('field.notes') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ch in previewChannels.slice(0, 20)" :key="ch.channel">
                <td class="px-3 py-2 text-white border-b border-white/10">{{ ch.channel }}</td>
                <td class="px-3 py-2 text-white border-b border-white/10">{{ ch.address }}</td>
                <td class="px-3 py-2 text-white border-b border-white/10">{{ ch.device }}</td>
                <td class="px-3 py-2 text-white border-b border-white/10">{{ ch.position }}</td>
                <td class="px-3 py-2 text-white border-b border-white/10">{{ ch.color }}</td>
                <td class="px-3 py-2 text-white border-b border-white/10">{{ ch.notes }}</td>
              </tr>
              <tr v-if="previewChannels.length > 20">
                <td colspan="6" class="px-3 py-2 text-gray-400 border-b border-white/10">{{ t('template.more_channels', { count: previewChannels.length - 20 }) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex justify-end gap-3 px-0 py-4 border-t border-white/10 mt-4">
          <span v-if="importError" class="text-sm text-red-400 flex-1">{{ importError }}</span>
          <button class="rounded-md px-3 py-2 text-sm font-semibold text-gray-400 ring-1 ring-white/10 hover:ring-white/20" @click="step = 'select'">{{ t('action.back') }}</button>
          <button class="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50" :disabled="importing || !importName.trim()" @click="handleImport">
            {{ importing ? '…' : t('template.upload.confirm') }}
          </button>
        </div>
      </div>

      <div v-else-if="step === 'done'" class="px-6 py-8 text-center">
        <p class="text-white mb-4">✓ {{ t('template.upload.success') }}</p>
        <button class="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50" @click="closeUpload">{{ t('action.close') }}</button>
      </div>
    </dialog>

    <!-- Detail dialog -->
    <dialog ref="detailDialog" class="m-auto w-full max-w-3xl rounded-xl bg-gray-900 ring-1 ring-white/10 shadow-2xl p-0 backdrop:bg-black/50">
      <div class="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <h3 class="text-base font-semibold text-white">{{ detailName }}</h3>
        <button class="rounded-md px-3 py-2 text-sm font-semibold text-gray-400 ring-1 ring-white/10 hover:ring-white/20" @click="detailDialog.close()">✕</button>
      </div>

      <div v-if="detailLoading" class="px-6 py-4 text-sm text-gray-400">{{ t('error.loading') }}</div>

      <template v-else>
        <div class="flex gap-1 px-6 pt-4 mb-4 border-b border-white/10">
          <button
            :class="['px-4 py-2 text-sm font-medium border-b-2 -mb-px', activeTab === 'channels' ? 'border-accent text-white' : 'border-transparent text-gray-400 hover:text-white']"
            @click="activeTab = 'channels'"
          >{{ t('show.channels') }}</button>
          <button
            :class="['px-4 py-2 text-sm font-medium border-b-2 -mb-px', activeTab === 'sections' ? 'border-accent text-white' : 'border-transparent text-gray-400 hover:text-white']"
            @click="activeTab = 'sections'"
          >{{ t('sections.btn') }}</button>
        </div>

        <div v-show="activeTab === 'channels'" class="overflow-x-auto px-6">
          <table class="min-w-full text-sm">
            <thead>
              <tr>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-400 border-b border-white/10 col-channel">{{ t('field.channel') }}</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-400 border-b border-white/10 col-address">{{ t('field.address') }}</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-400 border-b border-white/10 col-device">{{ t('field.device') }}</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-400 border-b border-white/10 col-position">{{ t('field.position') }}</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-400 border-b border-white/10 col-actions"></th>
              </tr>
            </thead>
            <tbody v-for="group in groupedChannels" :key="group.position">
              <tr class="category-header-row">
                <td colspan="5" class="px-3 py-2 border-b border-white/10">
                  <span class="category-name">{{ group.position || t('channel.no_category') }}</span>
                  <span class="category-count">{{ group.channels.length }}</span>
                </td>
              </tr>
              <tr v-for="ch in group.channels" :key="ch.channel" @click="startEdit(ch)">
                <td class="px-3 py-2 text-white border-b border-white/10 col-channel">
                  <input v-if="editingChannel === ch.channel" class="inline-input" v-model="editForm.channel" @click.stop />
                  <template v-else>{{ ch.channel }}</template>
                </td>
                <td class="px-3 py-2 text-white border-b border-white/10 col-address">
                  <input v-if="editingChannel === ch.channel" class="inline-input" v-model="editForm.address" @click.stop />
                  <template v-else>{{ ch.address }}</template>
                </td>
                <td class="px-3 py-2 text-white border-b border-white/10 col-device">
                  <input v-if="editingChannel === ch.channel" class="inline-input inline-input-wide" v-model="editForm.device" @click.stop />
                  <template v-else>{{ ch.device }}</template>
                </td>
                <td class="px-3 py-2 text-white border-b border-white/10 col-position">
                  <input v-if="editingChannel === ch.channel" class="inline-input" v-model="editForm.position" @click.stop />
                  <template v-else>{{ ch.position }}</template>
                </td>
                <td class="px-3 py-2 text-white border-b border-white/10 col-actions" @click.stop>
                  <template v-if="editingChannel === ch.channel">
                    <button class="rounded px-2 py-1 text-xs text-gray-400 ring-1 ring-white/10 hover:ring-white/20" @click="saveEdit(ch)">✓</button>
                    <button class="rounded px-2 py-1 text-xs text-gray-400 ring-1 ring-white/10 hover:ring-white/20" @click="cancelEdit">✕</button>
                  </template>
                  <button v-else class="rounded px-2 py-1 text-xs text-red-400 ring-1 ring-red-400/20 hover:ring-red-400/40" @click.stop="deleteChannel(ch)">✕</button>
                </td>
              </tr>
              <tr class="add-row-trigger">
                <td colspan="5" class="px-3 py-1 border-b border-white/10">
                  <button type="button" class="rounded px-2 py-1 text-xs text-gray-400 ring-1 ring-white/10 hover:ring-white/20" @click.stop="startAdd(group.position)">+ {{ t('channel.add') }}</button>
                </td>
              </tr>
              <tr v-if="addingToPosition === group.position" class="add-row-form">
                <td class="px-3 py-1 border-b border-white/10"><input class="inline-input" v-model="addForm.channel" :placeholder="t('show.channel.nr')" @click.stop /></td>
                <td class="px-3 py-1 border-b border-white/10"><input class="inline-input" v-model="addForm.address" :placeholder="t('show.channel.address.example')" @click.stop /></td>
                <td class="px-3 py-1 border-b border-white/10"><input class="inline-input inline-input-wide" v-model="addForm.device" @click.stop /></td>
                <td class="px-3 py-1 border-b border-white/10"><input class="inline-input" v-model="addForm.position" @click.stop /></td>
                <td class="px-3 py-1 border-b border-white/10" @click.stop>
                  <div class="add-row-actions flex gap-1">
                    <button class="rounded px-2 py-1 text-xs text-gray-400 ring-1 ring-white/10 hover:ring-white/20" @click="confirmAdd">✓</button>
                    <button class="rounded px-2 py-1 text-xs text-gray-400 ring-1 ring-white/10 hover:ring-white/20" @click="cancelAdd">✕</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Sections editor -->
        <div v-show="activeTab === 'sections'" class="px-6 py-4">
          <div v-for="(sec, idx) in templateSections" :key="sec.id" class="rounded-lg bg-gray-800/50 ring-1 ring-white/10 p-4 mb-3">
            <div class="section-card-header flex items-center gap-2 mb-2">
              <div class="section-reorder flex gap-1">
                <button class="rounded px-2 py-1 text-xs text-gray-400 ring-1 ring-white/10 hover:ring-white/20" :disabled="idx === 0" @click="moveSection(idx, -1)">↑</button>
                <button class="rounded px-2 py-1 text-xs text-gray-400 ring-1 ring-white/10 hover:ring-white/20" :disabled="idx === templateSections.length - 1" @click="moveSection(idx, 1)">↓</button>
              </div>
              <input :value="sec.title" :placeholder="t('sections.title.placeholder')" @input="sec.title = $event.target.value" @change="persistSections" class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent" />
              <select class="section-type-select rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10" :value="sec.type" @change="onTypeChange(sec, $event.target.value)">
                <option value="markdown">{{ t('sections.type.markdown') }}</option>
                <option value="fields" :disabled="hasFieldsType() && sec.type !== 'fields'">{{ t('sections.type.fields') }}</option>
              </select>
              <button class="rounded px-2 py-1 text-xs text-red-400 ring-1 ring-red-400/20 hover:ring-red-400/40" @click="deleteSection(idx)">✕</button>
            </div>
            <div v-if="sec.type === 'fields'" class="space-y-2">
              <div v-for="(field, fidx) in sec.fields" :key="field.key" class="fields-editor-row flex items-center gap-2">
                <input :value="field.label" :placeholder="t('sections.field.label')" @input="field.label = $event.target.value" @change="persistSections" class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent" />
                <button class="rounded px-2 py-1 text-xs text-red-400 ring-1 ring-red-400/20 hover:ring-red-400/40" @click="deleteField(sec, fidx)">✕</button>
              </div>
              <button class="rounded px-2 py-1 text-xs text-gray-400 ring-1 ring-white/10 hover:ring-white/20" @click="addField(sec)">{{ t('sections.field.add') }}</button>
            </div>
          </div>
          <button class="rounded px-2 py-1 text-xs text-gray-400 ring-1 ring-white/10 hover:ring-white/20" @click="addSection">{{ t('sections.add') }}</button>
        </div>
      </template>

      <div class="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
        <span v-if="detailSaving || sectionsSaving" class="text-sm text-gray-400">…</span>
        <button class="rounded-md px-3 py-2 text-sm font-semibold text-gray-400 ring-1 ring-white/10 hover:ring-white/20" @click="detailDialog.close()">{{ t('action.close') }}</button>
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
import { templateDisplayName } from '../utils/templateName.js'
import { uuid } from '../utils/uuid.js'

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
    importError.value = e?.message || t('template.upload.error')
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
    id: uuid(),
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
  section.fields.push({ key: uuid().slice(0, 8), label: '' })
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
  if (!window.confirm(t('template.delete.confirm', { name }))) return
  await deleteTemplate(name)
  templates.value = templates.value.filter(n => n !== name)
}
</script>
