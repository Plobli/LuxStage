<template>
  <div class="page">
    <div class="page-header">
      <button class="btn-ghost" @click="router.push('/')">← {{ t('action.back') }}</button>
      <h2>{{ meta.name }}</h2>
      <span class="show-date">{{ meta.datum }}</span>
      <a class="btn-ghost-sm" :href="pdfUrl" target="_blank">⎙ PDF</a>
    </div>

    <div v-if="loading" class="loading">…</div>

    <template v-else>
      <!-- Sections from template -->
      <template v-if="sortedSections.length > 0">
        <section v-for="sec in sortedSections" :key="sec.id" class="aufbau-section">
          <div class="aufbau-header">
            <span class="aufbau-label">{{ sec.title }}</span>
            <span v-if="sectionsSaving" class="saving-hint">…</span>
          </div>
          <!-- fields type -->
          <div v-if="sec.type === 'fields'" class="fields-grid">
            <div v-for="field in sec.fields" :key="field.key" class="fields-grid-row">
              <label class="fields-grid-label">{{ field.label }}<span v-if="field.unit" class="field-unit"> ({{ field.unit }})</span></label>
              <input class="inline-input"
                :value="parseFieldValue(sec.id, field.key)"
                @change="onFieldChange(sec.id, field.key, $event.target.value)"
                @click.stop
              />
            </div>
          </div>
          <!-- markdown type -->
          <MarkdownEditor v-else
            :modelValue="sectionContents.get(sec.id) ?? ''"
            class="aufbau-editor"
            @update:modelValue="onSectionChange(sec.id, $event)"
          />
        </section>
      </template>

      <!-- Fallback: old single aufbau section if no template sections defined -->
      <section v-else class="aufbau-section">
        <div class="aufbau-header">
          <span class="aufbau-label">{{ t('show.setup') }}</span>
          <span v-if="setupSaving" class="saving-hint">…</span>
        </div>
        <MarkdownEditor v-model="setupMarkdown" class="aufbau-editor" @update:modelValue="onSetupChange" />
      </section>

      <!-- Foto-Galerie -->
      <section class="photos-section">
        <div class="photos-header">
          <span class="photos-label">{{ t('show.photos') }}</span>
          <label class="btn-ghost-sm">
            + {{ t('photo.add') }}
            <input type="file" accept="image/*" multiple @change="onFileInput" hidden />
          </label>
        </div>
        <div
          class="photos-dropzone"
          :class="{ 'drag-over': dragging }"
          @dragover.prevent="dragging = true"
          @dragleave="dragging = false"
          @drop.prevent="onDrop"
        >
          <div v-if="photos.length === 0 && !dragging" class="photos-empty">{{ t('photo.empty') }}</div>
          <div class="photos-grid">
            <div v-for="filename in photos" :key="filename" class="photo-item">
              <img :src="getPhotoUrl(props.id, filename)" :alt="filename" @click="openLightbox(filename)" />
              <button class="btn-icon-danger" @click="onDeletePhoto(filename)" title="Löschen">🗑</button>
            </div>
          </div>
        </div>
      </section>

      <dialog ref="lightboxDialog" class="lightbox-dialog" @click="lightboxDialog.close()">
        <img v-if="lightboxPhoto" :src="getPhotoUrl(props.id, lightboxPhoto)" class="lightbox-img" />
      </dialog>

      <!-- Kanäle -->
      <section class="channel-section">
        <div class="channel-toolbar">
          <input v-model="search" type="search" :placeholder="t('channel.search')" class="search-input" />
          <span class="channel-count">{{ totalVisible }} / {{ channels.length }}</span>
          <span v-if="channelsSaving" class="saving-hint">…</span>
          <span v-if="dupWarning" class="dup-warning">⚠ {{ t('channel.dup_address') }}</span>
        </div>

        <div class="channel-table-wrapper">
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
              <tr
                v-for="ch in group.channels"
                :key="ch.channel"
                class="channel-row"
                :class="{ editing: editingChannel === ch.channel }"
                @click="startEdit(ch)"
                @keydown.enter.prevent="saveEdit"
                @keydown.escape="cancelEdit"
                @focusout="onRowFocusOut($event, ch)"
              >
                <td class="col-channel">{{ ch.channel }}</td>
                <td class="col-address">
                  <input v-if="editingChannel === ch.channel" class="inline-input" v-model="editForm.address" @click.stop />
                  <template v-else>{{ ch.address }}</template>
                </td>
                <td class="col-device">
                  <input v-if="editingChannel === ch.channel" class="inline-input" v-model="editForm.device" @click.stop />
                  <template v-else>{{ ch.device || '—' }}</template>
                </td>
                <td class="col-color">
                  <ColorPicker v-if="editingChannel === ch.channel" v-model="editForm.color" @click.stop />
                  <template v-else>
                    <span v-if="ch.color" class="color-badge">{{ ch.color }}</span>
                    <span v-else class="muted">—</span>
                  </template>
                </td>
                <td class="col-notes">
                  <div v-if="editingChannel === ch.channel" class="add-row-actions">
                    <input ref="notesInput" class="inline-input inline-input-wide" v-model="editForm.notes" @click.stop />
                    <button class="btn-danger-sm" @click.stop="deleteChannel(ch)" title="Löschen">🗑</button>
                  </div>
                  <template v-else>{{ ch.notes }}</template>
                </td>
              </tr>
              <!-- Kanal hinzufügen -->
              <tr v-if="addingPosition === group.position" class="channel-row editing" @keydown.escape="addingPosition = null">
                <td><input class="inline-input" v-model="addForm.channel" placeholder="Nr." @click.stop /></td>
                <td><input class="inline-input" v-model="addForm.address" placeholder="1/001" @click.stop /></td>
                <td><input class="inline-input" v-model="addForm.device" @click.stop /></td>
                <td><ColorPicker v-model="addForm.color" @click.stop /></td>
                <td>
                  <div class="add-row-actions">
                    <input class="inline-input inline-input-wide" v-model="addForm.notes" @click.stop />
                    <button class="btn-ghost-sm" @click.stop="saveAdd">✓</button>
                    <button class="btn-ghost-sm" @click.stop="addingPosition = null">✕</button>
                  </div>
                </td>
              </tr>
              <tr v-else class="add-row-trigger">
                <td colspan="5"><button type="button" class="btn-ghost-sm" @click.stop="startAdd(group.position)">+ {{ t('channel.add') }}</button></td>
              </tr>
            </tbody>
          </table>
          <p v-if="groupedChannels.length === 0" class="empty">{{ t('show.list.empty') }}</p>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useLocale } from '../composables/useLocale.js'
import MarkdownEditor from '../components/MarkdownEditor.vue'
import { fetchShow, updateContent } from '../api/shows.js'
import { fetchChannels, saveChannels } from '../api/channels.js'
import { fetchPhotos, uploadPhoto, deletePhoto, getPhotoUrl } from '../api/photos.js'
import { subscribeChannels } from '../api/client.js'
import { api } from '../api/client.js'
import ColorPicker from '../components/ColorPicker.vue'
import { fetchShowSections, saveShowSections, parseSectionsMd, serializeSectionsMd, fetchTemplateSections } from '../api/sections.js'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()
const { t } = useLocale()

// ── State ──────────────────────────────────────────────────────────────────
const loading = ref(true)
const meta = ref({})          // frontmatter: name, datum, venue, …
const setupMarkdown = ref('') // Aufbau-Abschnitt aus .md-Datei
const channels = ref([])
const photos = ref([])

const search = ref('')
const setupSaving = ref(false)
const channelsSaving = ref(false)

const sectionDefs = ref([])
const sectionContents = ref(new Map())
const sectionsSaving = ref(false)
let saveSectionsTimer = null

const sortedSections = computed(() =>
  [...sectionDefs.value].sort((a, b) => a.order - b.order)
)

// ── Editor ─────────────────────────────────────────────────────────────────
let saveSetupTimer = null

function onSetupChange(md) {
  clearTimeout(saveSetupTimer)
  saveSetupTimer = setTimeout(() => persistSetup(md), 800)
}

async function persistSetup(md) {
  setupSaving.value = true
  try {
    // Gesamte .md-Datei neu zusammenbauen: frontmatter + Markdown
    const newContent = buildFileContent(meta.value, md)
    await updateContent(props.id, newContent)
  } finally {
    setupSaving.value = false
  }
}

// ── PDF ────────────────────────────────────────────────────────────────────
const pdfUrl = computed(() => api.url(`/api/shows/${props.id}/pdf`))

// ── Kanal-Duplikat-Warnung ─────────────────────────────────────────────────
const dupWarning = computed(() => {
  const addresses = channels.value.map(c => c.address).filter(Boolean)
  return addresses.length !== new Set(addresses).size
})

// ── Kanäle gruppiert ───────────────────────────────────────────────────────
const groupedChannels = computed(() => {
  const q = search.value.toLowerCase()
  let chs = [...channels.value].sort((a, b) => parseInt(a.channel) - parseInt(b.channel))
  if (q) {
    chs = chs.filter(ch =>
      ch.channel?.includes(q) ||
      ch.device?.toLowerCase().includes(q) ||
      ch.notes?.toLowerCase().includes(q) ||
      ch.position?.toLowerCase().includes(q)
    )
  }
  const map = new Map()
  for (const ch of chs) {
    const pos = ch.position || ''
    if (!map.has(pos)) map.set(pos, [])
    map.get(pos).push(ch)
  }
  return [...map.entries()].map(([position, channels]) => ({ position, channels }))
})

const totalVisible = computed(() => groupedChannels.value.reduce((s, g) => s + g.channels.length, 0))

// ── Inline-Edit ────────────────────────────────────────────────────────────
const editingChannel = ref(null)
const editForm = ref({})
const notesInput = ref(null)

function startEdit(ch) {
  if (editingChannel.value === ch.channel) return
  if (editingChannel.value !== null) commitEdit()
  editingChannel.value = ch.channel
  editForm.value = { ...ch }
  nextTick(() => {
    const el = Array.isArray(notesInput.value) ? notesInput.value[0] : notesInput.value
    el?.focus()
  })
}

function cancelEdit() { editingChannel.value = null; editForm.value = {} }

function onRowFocusOut(event, ch) {
  if (editingChannel.value !== ch.channel) return
  if (!event.currentTarget.contains(event.relatedTarget)) commitEdit()
}

function saveEdit() { commitEdit() }

function commitEdit() {
  if (!editingChannel.value) return
  const idx = channels.value.findIndex(c => c.channel === editingChannel.value)
  if (idx !== -1) channels.value[idx] = { ...editForm.value }
  editingChannel.value = null
  editForm.value = {}
  persistChannels()
}

async function deleteChannel(ch) {
  if (!window.confirm(`Kanal ${ch.channel} wirklich löschen?`)) return
  channels.value = channels.value.filter(c => c.channel !== ch.channel)
  editingChannel.value = null
  persistChannels()
}

// ── Kanal hinzufügen ───────────────────────────────────────────────────────
const addingPosition = ref(null)
const addForm = ref({})

function startAdd(position) {
  addingPosition.value = position
  addForm.value = { channel: '', address: '', device: '', position, color: '', notes: '' }
}

function saveAdd() {
  if (!addForm.value.channel) return
  channels.value.push({ ...addForm.value })
  addingPosition.value = null
  persistChannels()
}

// ── Kanäle speichern ───────────────────────────────────────────────────────
let channelsSaveTimer = null
function persistChannels() {
  channelsSaving.value = true
  clearTimeout(channelsSaveTimer)
  channelsSaveTimer = setTimeout(async () => {
    try { await saveChannels(props.id, channels.value) }
    finally { channelsSaving.value = false }
  }, 400)
}

// ── Fotos ──────────────────────────────────────────────────────────────────
const dragging = ref(false)
const lightboxDialog = ref(null)
const lightboxPhoto = ref(null)

async function uploadFiles(files) {
  for (const file of files) {
    await uploadPhoto(props.id, file)
  }
  photos.value = await fetchPhotos(props.id)
}

function onFileInput(e) { uploadFiles([...e.target.files]); e.target.value = '' }
function onDrop(e) {
  dragging.value = false
  const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'))
  if (files.length) uploadFiles(files)
}

async function onDeletePhoto(filename) {
  if (!window.confirm('Foto wirklich löschen?')) return
  await deletePhoto(props.id, filename)
  photos.value = photos.value.filter(f => f !== filename)
}

function openLightbox(filename) {
  lightboxPhoto.value = filename
  lightboxDialog.value.showModal()
}

// ── Sections ───────────────────────────────────────────────────────────────

function onSectionChange(id, value) {
  sectionContents.value = new Map(sectionContents.value)
  sectionContents.value.set(id, value)
  clearTimeout(saveSectionsTimer)
  saveSectionsTimer = setTimeout(() => persistSections(), 800)
}

async function persistSections() {
  sectionsSaving.value = true
  try {
    const raw = serializeSectionsMd(sectionContents.value)
    await saveShowSections(props.id, raw)
  } finally {
    sectionsSaving.value = false
  }
}

function parseFieldValue(sectionId, key) {
  const raw = sectionContents.value.get(sectionId) ?? ''
  const match = raw.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))
  return match ? match[1].trim() : ''
}

function onFieldChange(sectionId, key, value) {
  let raw = sectionContents.value.get(sectionId) ?? ''
  const re = new RegExp(`^${key}:.*$`, 'm')
  if (re.test(raw)) {
    raw = raw.replace(re, `${key}: ${value}`)
  } else {
    raw = raw ? raw + `\n${key}: ${value}` : `${key}: ${value}`
  }
  onSectionChange(sectionId, raw)
}

// ── Laden ──────────────────────────────────────────────────────────────────
let unsubscribeSSE = null

onMounted(async () => {
  try {
    const [showData, chs, photoList, sectionsData] = await Promise.all([
      fetchShow(props.id),
      fetchChannels(props.id),
      fetchPhotos(props.id),
      fetchShowSections(props.id),
    ])

    meta.value = parseFrontmatter(showData.content)
    setupMarkdown.value = parseSetupSection(showData.content)
    channels.value = chs
    photos.value = photoList

    sectionContents.value = parseSectionsMd(sectionsData?.raw)

    if (meta.value.template) {
      const defs = await fetchTemplateSections(meta.value.template)
      sectionDefs.value = Array.isArray(defs) ? defs : (defs?.sections ?? [])
    }
  } catch (e) {
    console.error('Ladefehler:', e)
  } finally {
    loading.value = false
  }

  // SSE für Realtime-Updates von anderen Nutzern
  unsubscribeSSE = subscribeChannels(props.id, async () => {
    channels.value = await fetchChannels(props.id)
  })
})

onBeforeUnmount(() => {
  unsubscribeSSE?.()
  clearTimeout(saveSetupTimer)
  clearTimeout(channelsSaveTimer)
  clearTimeout(saveSectionsTimer)
})

// ── Hilfsfunktionen ────────────────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content?.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const result = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    result[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^"|"$/g, '')
  }
  return result
}

function parseSetupSection(content) {
  if (!content) return ''
  // Alles nach dem YAML frontmatter
  const withoutFm = content.replace(/^---\n[\s\S]*?\n---\n/, '')
  return withoutFm.trim()
}

function buildFileContent(fm, markdown) {
  const yamlLines = Object.entries(fm)
    .map(([k, v]) => `${k}: ${v.includes(':') || v.includes('"') ? `"${v}"` : v}`)
    .join('\n')
  return `---\n${yamlLines}\n---\n\n${markdown}\n`
}
</script>
