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

      <div v-else class="channel-table-wrapper">
        <table class="channel-table">
          <thead>
            <tr>
              <th class="col-channel">{{ t('field.channel') }}</th>
              <th class="col-address">{{ t('field.address') }}</th>
              <th class="col-device">{{ t('field.device') }}</th>
              <th class="col-color">{{ t('field.color') }}</th>
              <th class="col-notes">{{ t('field.notes') }}</th>
            </tr>
          </thead>
          <tbody v-for="group in groupedChannels" :key="group.position">
            <tr class="category-header-row">
              <td colspan="5">
                <span class="category-name">{{ group.position || t('channel.no_category') }}</span>
                <span class="category-count">{{ group.channels.length }}</span>
              </td>
            </tr>
            <tr v-for="ch in group.channels" :key="ch.channel">
              <td class="col-channel">{{ ch.channel }}</td>
              <td class="col-address">{{ ch.address }}</td>
              <td class="col-device">{{ ch.device }}</td>
              <td class="col-color">{{ ch.color }}</td>
              <td class="col-notes">{{ ch.notes }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="modal-footer">
        <button class="btn-ghost" @click="detailDialog.close()">{{ t('action.close') }}</button>
      </div>
    </dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useLocale } from '../composables/useLocale.js'
import { fetchTemplates, fetchTemplateChannels, uploadTemplate, deleteTemplate } from '../api/templates.js'
import { parseCsv } from '../api/channels.js'

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

async function showDetail(name) {
  detailName.value = name
  detailLoading.value = true
  detailDialog.value.showModal()
  detailChannels.value = await fetchTemplateChannels(name)
  detailLoading.value = false
}

async function handleDelete(name) {
  if (!window.confirm(`Vorlage „${name}" löschen?`)) return
  await deleteTemplate(name)
  templates.value = templates.value.filter(n => n !== name)
}
</script>
