<template>
  <div class="page">
    <div class="page-header">
      <button class="btn-ghost" @click="router.push('/')">← {{ $t('action.back') }}</button>
      <h2>{{ show?.name }}</h2>
      <span class="show-date">{{ formatDate(show?.date) }}</span>
      <button class="btn-ghost-sm" @click="exportShow">↓ JSON</button>
      <button class="btn-ghost-sm" @click="printPage">⎙ PDF</button>
    </div>

    <div v-if="loading" class="loading">…</div>

    <template v-else>
      <!-- Aufbau — WYSIWYG-Editor -->
      <section class="aufbau-section">
        <div class="aufbau-header">
          <span class="aufbau-label">{{ $t('show.aufbau') }}</span>
          <div class="aufbau-toolbar">
            <button class="btn-ghost-sm" :class="{ active: aufbauEditor?.isActive('bold') }" @click="aufbauEditor?.chain().focus().toggleBold().run()"><b>B</b></button>
            <button class="btn-ghost-sm" :class="{ active: aufbauEditor?.isActive('italic') }" @click="aufbauEditor?.chain().focus().toggleItalic().run()"><i>I</i></button>
            <button class="btn-ghost-sm" :class="{ active: aufbauEditor?.isActive('bulletList') }" @click="aufbauEditor?.chain().focus().toggleBulletList().run()">≡</button>
            <button class="btn-ghost-sm" :class="{ active: aufbauEditor?.isActive('heading', { level: 2 }) }" @click="aufbauEditor?.chain().focus().toggleHeading({ level: 2 }).run()">H2</button>
          </div>
        </div>
        <EditorContent :editor="aufbauEditor" class="aufbau-tiptap" />
      </section>

      <section class="custom-fields-section">
        <div v-for="field in allCustomFields" :key="field.field_name" class="custom-field-row">
          <label>
            {{ field.field_name }}
            <span v-if="field.unit_hint" class="hint">{{ field.unit_hint }}</span>
            <button class="field-delete-btn" @click="deleteShowField(field.field_name)" title="Löschen">✕</button>
          </label>
          <input
            :value="customValues[field.field_name] ?? ''"
            @input="debouncedUpdateCustomField(field.field_name, $event.target.value)"
            @change="updateCustomField(field.field_name, $event.target.value)"
            type="text"
          />
        </div>
        <div class="add-field-form">
          <button class="btn-ghost-sm" @click="addFieldDialog.showModal()">+ {{ $t('template.add_field') }}</button>
        </div>
      </section>

    <dialog ref="addFieldDialog" class="modal">
      <div class="modal-header">
        <h3>+ {{ $t('template.add_field') }}</h3>
        <button class="btn-ghost" @click="addFieldDialog.close()">✕</button>
      </div>
      <form @submit.prevent="addShowField">
        <div class="field">
          <label>{{ $t('template.field_name') }}</label>
          <input v-model="newShowField.field_name" type="text" required autofocus :placeholder="$t('template.field_name.example')" />
        </div>
        <div class="field">
          <label>{{ $t('template.unit_hint') }}</label>
          <input v-model="newShowField.unit_hint" type="text" :placeholder="$t('template.unit_hint.example')" />
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-ghost" @click="addFieldDialog.close()">{{ $t('action.cancel') }}</button>
          <button type="submit" class="btn-primary" :disabled="!newShowField.field_name">{{ $t('template.add_field') }}</button>
        </div>
      </form>
    </dialog>

      <!-- Foto-Galerie -->
      <section class="photos-section">
        <div class="photos-header">
          <span class="photos-label">{{ $t('show.photos') }}</span>
          <label class="btn-ghost-sm photos-upload-btn">
            + {{ $t('photo.add') }}
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
          <div v-if="photos.length === 0 && !dragging" class="photos-empty">{{ $t('photo.add') }}</div>
          <div class="photos-grid">
            <div v-for="photo in photos" :key="photo.id" class="photo-item">
              <img :src="getThumbUrl(photo)" :alt="photo.caption" @click="openPhoto(photo)" />
              <div class="photo-caption-row">
                <input
                  class="photo-caption-input"
                  :value="photo.caption"
                  :placeholder="$t('photo.caption')"
                  @change="onCaptionChange(photo, $event.target.value)"
                />
                <button class="btn-icon-danger" @click="onDeletePhoto(photo)" :title="$t('photo.delete')">🗑</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Lightbox -->
      <dialog ref="lightboxDialog" class="lightbox-dialog" @click="lightboxDialog.close()">
        <img v-if="lightboxPhoto" :src="getFullUrl(lightboxPhoto)" :alt="lightboxPhoto.caption" class="lightbox-img" />
      </dialog>

      <section class="channel-section">
        <div class="channel-toolbar">
          <input v-model="search" type="search" :placeholder="$t('channel.search')" class="search-input" />
          <span class="channel-count">{{ totalVisible }} / {{ channels.length }}</span>
        </div>

        <div class="channel-table-wrapper">
          <table class="channel-table">
            <thead>
              <tr>
                <th class="col-channel">{{ $t('field.channel_number') }}</th>
                <th class="col-address">{{ $t('field.address') }}</th>
                <th class="col-device">{{ $t('field.device') }}</th>
                <th class="col-color">{{ $t('field.color') }}</th>
                <th class="col-description">{{ $t('field.description') }}</th>
              </tr>
            </thead>
            <tbody v-for="group in groupedChannels" :key="group.category">
              <tr class="category-header-row">
                <td colspan="5">
                  <span class="category-name">{{ group.category || $t('channel.no_category') }}</span>
                  <span class="category-count">{{ group.channels.length }}</span>
                </td>
              </tr>
              <tr
                v-for="ch in group.channels"
                :key="ch.id"
                class="channel-row"
                :class="{ editing: editingId === ch.id, 'has-description': ch.description }"
                @click="onRowClick(ch, $event)"
                @focusout="onRowFocusOut($event, ch)"
                @keydown.enter.prevent="saveInline(ch)"
                @keydown.escape="cancelInline"
              >
                <td class="col-channel">{{ ch.channel_number }}</td>
                <td class="col-address">
                  <input v-if="editingId === ch.id" class="inline-input" v-model="inlineForm.address" placeholder="1/001" @click.stop />
                  <template v-else>{{ formatAddress(ch.universe, ch.dmx_address) }}</template>
                </td>
                <td class="col-device">
                  <input v-if="editingId === ch.id" class="inline-input" v-model="inlineForm.device" type="text" @click.stop />
                  <template v-else>{{ ch.device || '—' }}</template>
                </td>
                <td class="col-color">
                  <ColorPicker v-if="editingId === ch.id" v-model="inlineForm.color" class="inline-color-picker" @click.stop />
                  <template v-else>
                    <span v-if="ch.color" class="color-badge">{{ ch.color }}</span>
                    <span v-else class="muted">—</span>
                  </template>
                </td>
                <td class="col-description">
                  <div v-if="editingId === ch.id" class="add-row-actions">
                    <input ref="descriptionInput" class="inline-input inline-input-wide" v-model="inlineForm.description" type="text" @click.stop />
                    <button class="btn-danger-sm" @click.stop="confirmDeleteChannel(ch)" :title="$t('action.delete')">🗑</button>
                  </div>
                  <template v-else>{{ ch.description || '' }}</template>
                </td>
              </tr>
              <!-- Add row trigger / form -->
              <tr v-if="addingCategory === group.category" class="channel-row editing add-row-form" @keydown.escape="addingCategory = null">
                <td class="col-channel">
                  <input class="inline-input" v-model="addForm.channel_number" placeholder="Nr." @click.stop />
                </td>
                <td class="col-address">
                  <input class="inline-input" v-model="addForm.address" placeholder="1/001" @click.stop />
                </td>
                <td class="col-device">
                  <input class="inline-input" v-model="addForm.device" type="text" @click.stop />
                </td>
                <td class="col-color">
                  <ColorPicker v-model="addForm.color" class="inline-color-picker" @click.stop />
                </td>
                <td class="col-description">
                  <div class="add-row-actions">
                    <input class="inline-input inline-input-wide" v-model="addForm.description" type="text" @click.stop />
                    <button class="btn-ghost-sm" @click.stop="saveAdd(group.category)">✓</button>
                    <button class="btn-ghost-sm" @click.stop="addingCategory = null">✕</button>
                  </div>
                </td>
              </tr>
              <tr v-else class="add-row-trigger" @click.stop="startAdd(group.category)">
                <td colspan="5">+ {{ $t('channel.add') }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="groupedChannels.length === 0" class="empty">{{ $t('show.list.empty') }}</p>
        </div>
      </section>
    </template>

    <dialog ref="editDialog" class="modal modal-wide">
      <div class="modal-header">
        <h3>{{ $t('channel.edit') }} — {{ $t('field.channel_number') }} {{ editing?.channel_number }}</h3>
        <button class="btn-ghost" @click="editDialog.close()">✕</button>
      </div>
      <form v-if="editing" @submit.prevent="saveDialog">
        <div class="field-row">
          <div class="field">
            <label>{{ $t('field.device') }}</label>
            <input v-model="editForm.device" type="text" />
          </div>
          <div class="field">
            <label>{{ $t('field.address') }}</label>
            <input v-model="editForm.addressDisplay" type="text" disabled />
          </div>
        </div>
        <div class="field">
          <label>{{ $t('field.description') }}</label>
          <input v-model="editForm.description" type="text" />
        </div>
        <div class="field-row">
          <div class="field">
            <label>{{ $t('field.color') }}</label>
            <ColorPicker v-model="editForm.color" />
          </div>
          <div class="field">
            <label>{{ $t('field.category') }}</label>
            <input v-model="editForm.category" type="text" />
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-danger-sm" style="margin-right:auto" @click="confirmDeleteFromDialog">{{ $t('action.delete') }}</button>
          <button type="button" class="btn-ghost" @click="editDialog.close()">{{ $t('action.cancel') }}</button>
          <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? '…' : $t('action.save') }}</button>
        </div>
      </form>
    </dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { fetchPhotos, uploadPhoto, updateCaption, deletePhoto, getThumbUrl, getFullUrl } from '../api/photos.js'
import { subscribeChannels } from '../api/realtime.js'
import { useRouter } from 'vue-router'
import { fetchShow, updateShow } from '../api/shows.js'
import { fetchChannels, updateChannel, createChannel, deleteChannel } from '../api/channels.js'
import { fetchTemplateCustomFields } from '../api/templates.js'
import { exportShowBackup } from '../api/backup.js'
import { formatAddress } from '../api/csv.js'
import ColorPicker from '../components/ColorPicker.vue'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()

const show = ref(null)
const channels = ref([])
const customFields = ref([])
const loading = ref(true)
const search = ref('')
const saving = ref(false)

const editMode = computed(() => localStorage.getItem('channel_edit_mode') || 'inline')

const editingId = ref(null)
const inlineForm = ref({})
const descriptionInput = ref(null)

const editing = ref(null)
const editForm = ref({})
const editDialog = ref(null)

const addingCategory = ref(null)
const addForm = ref({})

const addFieldDialog = ref(null)

let aufbauSaveTimer = null
const aufbauEditor = useEditor({
  extensions: [StarterKit],
  content: '',
  editorProps: { attributes: { class: 'aufbau-editor-content' } },
  onUpdate({ editor }) {
    clearTimeout(aufbauSaveTimer)
    aufbauSaveTimer = setTimeout(() => {
      const html = editor.getHTML()
      updateCustomField('Aufbau', html === '<p></p>' ? '' : html)
    }, 600)
  },
})

const newShowField = ref({ field_name: '', unit_hint: '' })

// Fotos
const photos = ref([])
const dragging = ref(false)
const lightboxDialog = ref(null)
const lightboxPhoto = ref(null)

async function loadPhotos() {
  photos.value = await fetchPhotos(props.id)
}

async function uploadFiles(files) {
  for (const file of files) {
    const created = await uploadPhoto(props.id, file)
    photos.value.unshift(created)
  }
}

function onFileInput(e) { uploadFiles([...e.target.files]); e.target.value = '' }

function onDrop(e) {
  dragging.value = false
  const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'))
  if (files.length) uploadFiles(files)
}

async function onCaptionChange(photo, caption) {
  const updated = await updateCaption(photo.id, caption)
  const idx = photos.value.findIndex(p => p.id === photo.id)
  if (idx !== -1) photos.value[idx] = updated
}

async function onDeletePhoto(photo) {
  if (!window.confirm('Foto wirklich löschen?')) return
  await deletePhoto(photo.id)
  photos.value = photos.value.filter(p => p.id !== photo.id)
}

function openPhoto(photo) {
  lightboxPhoto.value = photo
  lightboxDialog.value.showModal()
}

// Einleucht-Checklist
const customValues = ref({})

// All custom fields for this show: template fields (minus hidden) + show-specific extras
const allCustomFields = computed(() => {
  const hidden = customValues.value.__hidden__ || []
  const extra = customValues.value.__extra__ || []
  const fromTemplate = customFields.value.filter(f => !hidden.includes(f.field_name))
  return [...fromTemplate, ...extra]
})

const groupedChannels = computed(() => {
  const q = search.value.toLowerCase()
  let chans = [...channels.value].sort((a, b) => parseInt(a.channel_number) - parseInt(b.channel_number))
  if (q) {
    chans = chans.filter(ch =>
      ch.channel_number?.includes(q) ||
      ch.device?.toLowerCase().includes(q) ||
      ch.description?.toLowerCase().includes(q) ||
      ch.category?.toLowerCase().includes(q)
    )
  }
  const groups = {}
  for (const ch of chans) {
    const cat = ch.category || ''
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(ch)
  }
  // Preserve insertion order — categories appear in channel-number order (lowest first)
  return Object.entries(groups).map(([category, chs]) => ({ category, channels: chs }))
})

const totalVisible = computed(() => groupedChannels.value.reduce((s, g) => s + g.channels.length, 0))

let unsubscribeRealtime = null

onMounted(async () => {
  const [s, chs] = await Promise.all([fetchShow(props.id), fetchChannels(props.id)])
  show.value = s
  channels.value = chs
  const rawCfv = s.custom_field_values
  if (typeof rawCfv === 'string') { try { customValues.value = JSON.parse(rawCfv) } catch { customValues.value = {} } }
  else if (rawCfv && typeof rawCfv === 'object') customValues.value = rawCfv
  const templateId = s.expand?.template?.id ?? s.template
  if (templateId) customFields.value = await fetchTemplateCustomFields(templateId)
  loadPhotos()
  loading.value = false
  await nextTick()
  aufbauEditor.value?.commands.setContent(customValues.value['Aufbau'] || '', false)
  unsubscribeRealtime = subscribeChannels(props.id, {
    onUpsert(record) {
      const idx = channels.value.findIndex(c => c.id === record.id)
      if (idx !== -1) channels.value[idx] = record
      else channels.value.push(record)
    },
    onDelete(id) {
      channels.value = channels.value.filter(c => c.id !== id)
    },
  })
})

onUnmounted(() => {
  unsubscribeRealtime?.()
  clearTimeout(aufbauSaveTimer)
  Object.values(customFieldTimers).forEach(clearTimeout)
})

async function saveCustomValues(values) {
  try {
    const plain = JSON.parse(JSON.stringify(values))
    await updateShow(props.id, { custom_field_values: plain })
    customValues.value = plain
  } catch (e) {
    console.error('[saveCustomValues]', e)
  }
}

async function updateCustomField(fieldName, value) {
  await saveCustomValues({ ...customValues.value, [fieldName]: value })
}

const customFieldTimers = {}
function debouncedUpdateCustomField(fieldName, value) {
  clearTimeout(customFieldTimers[fieldName])
  customFieldTimers[fieldName] = setTimeout(() => updateCustomField(fieldName, value), 600)
}

async function addShowField() {
  if (!newShowField.value.field_name) return
  const current = { ...customValues.value }
  const extra = [...(current.__extra__ || []), { field_name: newShowField.value.field_name, unit_hint: newShowField.value.unit_hint }]
  current.__extra__ = extra
  await saveCustomValues(current)
  newShowField.value = { field_name: '', unit_hint: '' }
  addFieldDialog.value.close()
}

async function deleteShowField(fieldName) {
  if (!window.confirm(`Feld „${fieldName}" aus dieser Show entfernen?`)) return
  const current = { ...customValues.value }
  // If it's a template field, mark as hidden
  if (customFields.value.some(f => f.field_name === fieldName)) {
    current.__hidden__ = [...(current.__hidden__ || []), fieldName]
  } else {
    // Remove from extra fields
    current.__extra__ = (current.__extra__ || []).filter(f => f.field_name !== fieldName)
  }
  // Remove any stored value
  delete current[fieldName]
  await saveCustomValues(current)
}

function parseAddress(str) {
  if (!str) return { universe: null, dmx_address: null }
  const [u, d] = str.split('/')
  return { universe: parseInt(u) || null, dmx_address: parseInt(d) || null }
}

function onRowClick(ch, _event) {
  if (editMode.value === 'dialog') { openDialog(ch); return }
  if (editingId.value === ch.id) return
  if (editingId.value !== null) {
    const prev = channels.value.find(c => c.id === editingId.value)
    if (prev) commitInline(prev)
  }
  startInline(ch)
}

async function startInline(ch) {
  editingId.value = ch.id
  inlineForm.value = {
    device: ch.device ?? '',
    description: ch.description ?? '',
    color: ch.color ?? '',
    category: ch.category ?? '',
    address: formatAddress(ch.universe, ch.dmx_address),
  }
  await nextTick()
  const el = Array.isArray(descriptionInput.value) ? descriptionInput.value[0] : descriptionInput.value
  el?.focus()
}

function cancelInline() { editingId.value = null; inlineForm.value = {} }

function onRowFocusOut(event, ch) {
  if (editingId.value !== ch.id) return
  if (!event.currentTarget.contains(event.relatedTarget)) saveInline(ch)
}

async function saveInline(ch) {
  if (editingId.value !== ch.id) return
  commitInline(ch)
}

async function commitInline(ch) {
  const id = ch.id
  const form = { ...inlineForm.value }
  editingId.value = null
  inlineForm.value = {}
  const { universe, dmx_address } = parseAddress(form.address)
  try {
    const updated = await updateChannel(id, {
      device: form.device,
      description: form.description,
      color: form.color,
      category: form.category,
      universe,
      dmx_address,
    })
    const idx = channels.value.findIndex(c => c.id === id)
    if (idx !== -1) channels.value[idx] = updated
  } catch { /* silently ignore */ }
}

function openDialog(ch) {
  editing.value = ch
  editForm.value = { device: ch.device ?? '', description: ch.description ?? '', color: ch.color ?? '', category: ch.category ?? '', addressDisplay: formatAddress(ch.universe, ch.dmx_address) }
  editDialog.value.showModal()
}

async function saveDialog() {
  saving.value = true
  try {
    const updated = await updateChannel(editing.value.id, { device: editForm.value.device, description: editForm.value.description, color: editForm.value.color, category: editForm.value.category })
    const idx = channels.value.findIndex(c => c.id === updated.id)
    if (idx !== -1) channels.value[idx] = updated
    editDialog.value.close()
  } finally { saving.value = false }
}

function startAdd(category) {
  addingCategory.value = category
  addForm.value = { channel_number: '', device: '', color: '', description: '', address: '' }
}

async function saveAdd(category) {
  const { universe, dmx_address } = parseAddress(addForm.value.address)
  try {
    const created = await createChannel(props.id, {
      channel_number: addForm.value.channel_number,
      universe,
      dmx_address,
      device: addForm.value.device,
      color: addForm.value.color,
      description: addForm.value.description,
      category,
    })
    channels.value.push(created)
  } catch { /* silently ignore */ }
  addingCategory.value = null
}

async function confirmDeleteChannel(ch) {
  if (!window.confirm('Kanal ' + ch.channel_number + ' wirklich löschen?')) return
  try {
    await deleteChannel(ch.id)
    channels.value = channels.value.filter(c => c.id !== ch.id)
    editingId.value = null
  } catch { /* silently ignore */ }
}

async function confirmDeleteFromDialog() {
  if (!editing.value) return
  if (!window.confirm('Kanal ' + editing.value.channel_number + ' wirklich löschen?')) return
  try {
    await deleteChannel(editing.value.id)
    channels.value = channels.value.filter(c => c.id !== editing.value.id)
    editDialog.value.close()
  } catch { /* silently ignore */ }
}

function exportShow() { exportShowBackup(props.id) }
function printPage() { window.print() }

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString()
}
</script>
