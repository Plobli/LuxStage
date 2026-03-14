<template>
  <div class="page">
    <div class="page-header">
      <h2>{{ $t('nav.templates') }}</h2>
      <button class="btn-primary" @click="uploadDialog.showModal()">
        {{ $t('template.upload') }}
      </button>
    </div>

    <div v-if="loading" class="loading">…</div>

    <div v-else-if="templates.length === 0" class="empty">
      {{ $t('template.list.empty') }}
    </div>

    <div v-else class="template-list">
      <div v-for="t in templates" :key="t.id" class="template-card">
        <div class="template-card-header">
          <span class="template-name">{{ t.venue_name }}</span>
          <span class="template-hall">{{ t.name }}</span>
          <span class="tag">v{{ t.version }}</span>
        </div>
        <div class="template-card-meta">
          <span>{{ $t('template.created') }}: {{ formatDate(t.created) }}</span>
          <button class="btn-ghost-sm" @click="showDetail(t)">Details</button>
        </div>
      </div>
    </div>

    <!-- Upload dialog -->
    <dialog ref="uploadDialog" class="modal modal-wide">
      <div class="modal-header">
        <h3>{{ $t('template.upload') }}</h3>
        <button class="btn-ghost" @click="closeUpload">✕</button>
      </div>

      <!-- Step 1: File selection -->
      <div v-if="step === 'select'" class="upload-drop-zone" @dragover.prevent @drop.prevent="onDrop">
        <input ref="fileInput" type="file" accept=".csv,.txt" hidden @change="onFileChange" />
        <p>{{ $t('template.upload.hint') }}</p>
        <button class="btn-primary" @click="fileInput.click()">CSV wählen</button>
        <a href="/docs/example-template.csv" download class="btn-ghost-sm">
          Beispieldatei herunterladen
        </a>
      </div>

      <!-- Step 2: Preview & errors -->
      <div v-else-if="step === 'preview'">
        <div v-if="parseErrors.length" class="error-list">
          <p><strong>Fehler in der CSV-Datei:</strong></p>
          <ul>
            <li v-for="(e, i) in parseErrors" :key="i">
              {{ $t(e.key, e.params) }}
            </li>
          </ul>
          <button class="btn-ghost" @click="step = 'select'">Zurück</button>
        </div>
        <div v-else class="preview">
          <div class="preview-meta">
            <div class="field">
              <label>Bühnenname</label>
              <input v-model="importVenueName" type="text" required />
            </div>
            <div class="field">
              <label>{{ $t('template.name') }}</label>
              <input v-model="importName" type="text" required />
            </div>
            <div class="preview-stats">
              <span>{{ $t('csv.preview.channels', { count: parsed.channels.length }) }}</span>
              <span>{{ $t('csv.preview.custom_fields', { count: parsed.custom_fields.length }) }}</span>
            </div>
          </div>

          <div v-if="parsed.custom_fields.length" class="preview-fields">
            <p><strong>{{ $t('template.custom_fields') }}:</strong></p>
            <ul>
              <li v-for="f in parsed.custom_fields" :key="f.field_name">
                {{ f.field_name }}<span v-if="f.unit_hint" class="hint"> ({{ f.unit_hint }})</span>
              </li>
            </ul>
          </div>

          <div class="channel-table-wrapper">
            <table class="channel-table preview-table">
              <thead>
                <tr>
                  <th>{{ $t('field.channel_number') }}</th>
                  <th>{{ $t('field.address') }}</th>
                  <th>{{ $t('field.device') }}</th>
                  <th>{{ $t('field.color') }}</th>
                  <th>{{ $t('field.description') }}</th>
                  <th>{{ $t('field.category') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="ch in parsed.channels.slice(0, 20)" :key="ch.channel_number">
                  <td>{{ ch.channel_number }}</td>
                  <td>{{ formatAddr(ch) }}</td>
                  <td>{{ ch.device }}</td>
                  <td>{{ ch.color }}</td>
                  <td>{{ ch.description }}</td>
                  <td>{{ ch.category }}</td>
                </tr>
                <tr v-if="parsed.channels.length > 20">
                  <td colspan="6" class="muted">… {{ parsed.channels.length - 20 }} weitere Kanäle</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="modal-footer">
            <span v-if="importError" class="error-msg" style="flex:1">{{ importError }}</span>
            <button class="btn-ghost" @click="step = 'select'">{{ $t('action.back') }}</button>
            <button class="btn-primary" :disabled="importing || !importVenueName || !importName" @click="handleImport">
              {{ importing ? '…' : $t('template.upload.confirm') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Step 3: Success -->
      <div v-else-if="step === 'done'" class="import-success">
        <p>✓ {{ $t('template.upload.success') }}</p>
        <button class="btn-primary" @click="closeUpload">{{ $t('action.close') }}</button>
      </div>
    </dialog>

    <!-- Detail dialog -->
    <dialog ref="detailDialog" class="modal modal-wide">
      <div class="modal-header">
        <div class="detail-title-edit">
          <input
            v-if="detailTemplate"
            v-model="detailVenueName"
            class="inline-input detail-venue-input"
            placeholder="Bühnenname"
            @blur="saveDetailNames"
          />
          <span class="detail-title-sep">—</span>
          <input
            v-if="detailTemplate"
            v-model="detailTemplateName"
            class="inline-input detail-name-input"
            placeholder="Vorlagenname"
            @blur="saveDetailNames"
          />
          <span v-if="detailNameSaved" class="detail-saved-hint">✓</span>
        </div>
        <button class="btn-ghost" @click="detailDialog.close()">✕</button>
      </div>

      <!-- Custom fields section -->
      <div class="detail-custom-fields">
        <p class="detail-section-label">{{ $t('template.custom_fields') }}</p>
        <ul v-if="detailCustomFields.length" class="detail-field-list">
          <li v-for="f in detailCustomFields" :key="f.id" class="detail-field-item">
            <span><strong>{{ f.field_name }}</strong><span v-if="f.unit_hint" class="hint"> ({{ f.unit_hint }})</span></span>
            <button class="field-delete-btn" @click="deleteCustomField(f)" title="Löschen">✕</button>
          </li>
        </ul>
        <p v-else class="muted" style="font-size:12px; margin-bottom:8px">—</p>
        <div class="add-field-form">
          <button class="btn-ghost-sm" @click="addFieldDialog.showModal()">+ {{ $t('template.add_field') }}</button>
        </div>
      </div>

      <!-- Channels grouped by category -->
      <div v-if="detailGroupedChannels.length" class="channel-table-wrapper">
        <table class="channel-table">
          <thead>
            <tr>
              <th class="col-channel">{{ $t('field.channel_number') }}</th>
              <th class="col-address">{{ $t('field.address') }}</th>
              <th class="col-device">{{ $t('field.device') }}</th>
              <th class="col-color">{{ $t('field.color') }}</th>
              <th class="col-description">{{ $t('field.description') }}</th>
              <th class="col-category">{{ $t('field.category') }}</th>
            </tr>
          </thead>
          <tbody v-for="group in detailGroupedChannels" :key="group.category">
            <tr class="category-header-row">
              <td colspan="6">
                <span class="category-name">{{ group.category || $t('channel.no_category') }}</span>
                <span class="category-count">{{ group.channels.length }}</span>
              </td>
            </tr>
            <tr v-for="ch in group.channels" :key="ch.id">
              <td class="col-channel">{{ ch.channel_number }}</td>
              <td class="col-address">{{ formatAddress(ch.universe, ch.dmx_address) }}</td>
              <td class="col-device">{{ ch.device }}</td>
              <td class="col-color">{{ ch.color }}</td>
              <td class="col-description">{{ ch.description }}</td>
              <td class="col-category">{{ ch.category }}</td>
            </tr>
            <!-- Add channel row -->
            <tr v-if="detailAddingCategory === group.category" class="channel-row editing add-row-form">
              <td class="col-channel"><input class="inline-input" v-model="detailAddForm.channel_number" placeholder="Nr." /></td>
              <td class="col-address"><input class="inline-input" v-model="detailAddForm.address" placeholder="1/001" /></td>
              <td class="col-device"><input class="inline-input" v-model="detailAddForm.device" type="text" /></td>
              <td class="col-color"><input class="inline-input" v-model="detailAddForm.color" type="text" /></td>
              <td class="col-description">
                <div class="add-row-actions">
                  <input class="inline-input inline-input-wide" v-model="detailAddForm.description" type="text" />
                  <button class="btn-ghost-sm" @click="saveDetailAdd(group.category)">✓</button>
                  <button class="btn-ghost-sm" @click="detailAddingCategory = null">✕</button>
                </div>
              </td>
              <td class="col-category"></td>
            </tr>
            <tr v-else class="add-row-trigger" @click="startDetailAdd(group.category)">
              <td colspan="6">+ {{ $t('channel.add') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </dialog>

    <!-- Add custom field dialog -->
    <dialog ref="addFieldDialog" class="modal">
      <div class="modal-header">
        <h3>+ {{ $t('template.add_field') }}</h3>
        <button class="btn-ghost" @click="addFieldDialog.close()">✕</button>
      </div>
      <form @submit.prevent="addCustomField">
        <div class="field">
          <label>{{ $t('template.field_name') }}</label>
          <input v-model="newField.field_name" type="text" required autofocus :placeholder="$t('template.field_name.example')" />
        </div>
        <div class="field">
          <label>{{ $t('template.unit_hint') }}</label>
          <input v-model="newField.unit_hint" type="text" :placeholder="$t('template.unit_hint.example')" />
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-ghost" @click="addFieldDialog.close()">{{ $t('action.cancel') }}</button>
          <button type="submit" class="btn-primary" :disabled="!newField.field_name">{{ $t('template.add_field') }}</button>
        </div>
      </form>
    </dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { fetchTemplates, fetchTemplateChannels, saveTemplate, deleteTemplate, uploadTemplate } from '../api/templates.js'
import { parseCsv as parseTemplateCSV } from '../api/channels.js'

// formatAddress: "1/001" bleibt as-is in v1.1
function formatAddress(universe, dmxAddress) {
  if (universe == null || dmxAddress == null) return '—'
  return `${universe}/${String(dmxAddress).padStart(3, '0')}`
}

const templates = ref([])
const loading = ref(true)
const uploadDialog = ref(null)
const detailDialog = ref(null)
const fileInput = ref(null)
const csvFile = ref(null)

const step = ref('select')
const parsed = ref(null)
const parseErrors = ref([])
const importName = ref('')
const importVenueName = ref('')
const importing = ref(false)
const importError = ref('')

const detailTemplate = ref(null)
const detailVenueName = ref('')
const detailTemplateName = ref('')
const detailNameSaved = ref(false)
const detailChannels = ref([])
const detailCustomFields = ref([])
const newField = ref({ field_name: '', unit_hint: '' })

const detailAddingCategory = ref(null)
const detailAddForm = ref({})
const addFieldDialog = ref(null)

const detailGroupedChannels = computed(() => {
  const chans = [...detailChannels.value].sort((a, b) => parseInt(a.channel_number) - parseInt(b.channel_number))
  const groups = {}
  for (const ch of chans) {
    const cat = ch.category || ''
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(ch)
  }
  return Object.entries(groups).map(([category, chs]) => ({ category, channels: chs }))
})

onMounted(async () => {
  templates.value = await fetchTemplates()
  loading.value = false
})

async function showDetail(t) {
  detailTemplate.value = t
  detailVenueName.value = t.venue_name
  detailTemplateName.value = t.name
  detailNameSaved.value = false
  detailChannels.value = await fetchTemplateChannels(t.id)
  detailCustomFields.value = await fetchTemplateCustomFields(t.id)
  newField.value = { field_name: '', unit_hint: '' }
  detailAddingCategory.value = null
  detailDialog.value.showModal()
}

async function saveDetailNames() {
  if (!detailTemplate.value) return
  const vn = detailVenueName.value.trim()
  const tn = detailTemplateName.value.trim()
  if (!vn || !tn) return
  if (vn === detailTemplate.value.venue_name && tn === detailTemplate.value.name) return
  await updateTemplate(detailTemplate.value.id, { venue_name: vn, name: tn })
  detailTemplate.value = { ...detailTemplate.value, venue_name: vn, name: tn }
  const idx = templates.value.findIndex(t => t.id === detailTemplate.value.id)
  if (idx !== -1) templates.value[idx] = { ...templates.value[idx], venue_name: vn, name: tn }
  detailNameSaved.value = true
  setTimeout(() => { detailNameSaved.value = false }, 2000)
}

async function addCustomField() {
  if (!newField.value.field_name) return
  const field = await createTemplateCustomField(detailTemplate.value.id, { ...newField.value })
  detailCustomFields.value.push(field)
  newField.value = { field_name: '', unit_hint: '' }
  addFieldDialog.value.close()
}

async function deleteCustomField(f) {
  if (!window.confirm(`Feld „${f.field_name}" aus der Vorlage löschen?`)) return
  await deleteTemplateCustomField(f.id)
  detailCustomFields.value = detailCustomFields.value.filter(x => x.id !== f.id)
}

function parseAddress(str) {
  if (!str) return { universe: null, dmx_address: null }
  const [u, d] = str.split('/')
  return { universe: parseInt(u) || null, dmx_address: parseInt(d) || null }
}

function startDetailAdd(category) {
  detailAddingCategory.value = category
  detailAddForm.value = { channel_number: '', device: '', color: '', description: '', address: '' }
}

async function saveDetailAdd(category) {
  const { universe, dmx_address } = parseAddress(detailAddForm.value.address)
  try {
    const created = await createTemplateChannel(detailTemplate.value.id, {
      channel_number: detailAddForm.value.channel_number,
      universe,
      dmx_address,
      device: detailAddForm.value.device,
      color: detailAddForm.value.color,
      description: detailAddForm.value.description,
      category,
    })
    detailChannels.value.push(created)
  } catch { /* silently ignore */ }
  detailAddingCategory.value = null
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
  csvFile.value = file
  importName.value = file.name.replace(/\.csv$/i, '')
  const reader = new FileReader()
  reader.onload = (e) => {
    parsed.value = parseTemplateCSV(e.target.result)
    parseErrors.value = parsed.value.errors
    importVenueName.value = parsed.value.venue_name || ''
    step.value = 'preview'
  }
  reader.readAsText(file, 'utf-8')
}

async function handleImport() {
  importing.value = true
  importError.value = ''
  try {
    const existing = templates.value.filter(t => t.venue_name === importVenueName.value)
    const version = existing.length ? Math.max(...existing.map(t => t.version ?? 1)) + 1 : 1

    const template = await createTemplate(
      { name: importName.value, venue_name: importVenueName.value, version },
      csvFile.value,
    )

    for (const field of parsed.value.custom_fields) {
      const { position: _p, ...fieldData } = field
      await createTemplateCustomField(template.id, fieldData)
    }

    for (const ch of parsed.value.channels) {
      const { position: _p, ...chData } = ch
      await createTemplateChannel(template.id, chData)
    }

    templates.value = await fetchTemplates()
    step.value = 'done'
  } catch (e) {
    const fieldErrors = e?.data?.data
    if (fieldErrors && Object.keys(fieldErrors).length) {
      importError.value = Object.entries(fieldErrors)
        .map(([field, err]) => `${field}: ${err.message}`)
        .join(' | ')
    } else {
      importError.value = e?.data?.message || e?.message || 'Unbekannter Fehler'
    }
  } finally {
    importing.value = false
  }
}

function closeUpload() {
  uploadDialog.value.close()
  step.value = 'select'
  csvFile.value = null
  parsed.value = null
  parseErrors.value = []
  importError.value = ''
  importVenueName.value = ''
}

function formatAddr(ch) {
  return formatAddress(ch.universe, ch.dmx_address)
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString()
}
</script>
