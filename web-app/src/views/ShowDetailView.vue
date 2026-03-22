<template>
  <div>
    <!-- Top Header -->
    <div class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-white/10 bg-gray-950 px-4 sm:px-6 lg:px-8">
      <button type="button" class="text-gray-400 hover:text-white" @click="router.push('/')">
        <span class="sr-only">{{ t('action.back') }}</span>
        <svg class="size-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clip-rule="evenodd" /></svg>
      </button>
      <div class="h-6 w-px bg-white/10" aria-hidden="true"></div>
      <div class="flex min-w-0 flex-1 items-center gap-x-3">
        <h1 class="text-sm font-semibold text-white truncate">{{ meta.name }}</h1>
        <span class="hidden sm:block text-xs text-gray-500 shrink-0">{{ meta.datum }}</span>
        <span v-if="channelsSaving || sectionsSaving || setupSaving" class="text-xs text-gray-500 shrink-0">…</span>
      </div>
      <!-- Suchfeld rechtsbündig -->
      <div class="flex items-center gap-x-3 shrink-0">
        <span v-if="dupWarning" class="text-xs text-yellow-400">⚠ {{ t('channel.dup_address') }}</span>
        <div class="grid grid-cols-1">
          <input
            v-model="search"
            type="search"
            :placeholder="t('channel.search')"
            class="col-start-1 row-start-1 block w-48 bg-white/5 py-1.5 pr-3 pl-9 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent rounded-md placeholder:text-gray-500"
          />
          <MagnifyingGlassIcon class="pointer-events-none col-start-1 row-start-1 ml-3 size-4 self-center text-gray-400" aria-hidden="true" />
        </div>
      </div>
      <div class="h-6 w-px bg-white/10 shrink-0" aria-hidden="true"></div>
      <div class="flex items-center gap-x-3 shrink-0">
        <button
          type="button"
          :class="editingSections ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'"
          class="rounded-md px-3 py-1.5 text-sm font-semibold"
          @click="editingSections = !editingSections"
        >
          {{ t('sections.btn') }}
        </button>
        <a
          :href="pdfUrl"
          target="_blank"
          class="rounded-md px-3 py-1.5 text-sm font-semibold text-gray-400 ring-1 ring-white/10 hover:ring-white/20"
        >
          {{ t('show.pdf') }}
        </a>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center h-64 text-sm text-gray-400">…</div>

    <template v-else>
      <!-- Sections-Editor (overlay panel) -->
      <div v-if="editingSections" class="border-b border-white/10 bg-gray-950/80 px-4 py-4 sm:px-6 lg:px-8 space-y-3">
        <div
          v-for="(sec, idx) in sectionDefs"
          :key="sec.id"
          class="rounded-lg bg-gray-800/50 ring-1 ring-white/10 p-4"
        >
          <div class="flex items-center gap-3 mb-2">
            <div class="flex gap-1">
              <button class="text-gray-400 hover:text-white text-xs px-1" :disabled="idx === 0" @click="moveSectionDef(idx, -1)">↑</button>
              <button class="text-gray-400 hover:text-white text-xs px-1" :disabled="idx === sectionDefs.length - 1" @click="moveSectionDef(idx, 1)">↓</button>
            </div>
            <input
              :value="sec.title"
              :placeholder="t('sections.title.placeholder')"
              @input="sec.title = $event.target.value"
              @change="persistSectionDefs"
              class="flex-1 rounded-md bg-white/5 px-3 py-1 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent"
            />
            <select
              :value="sec.type"
              @change="onSectionTypeChange(sec, $event.target.value)"
              class="rounded-md bg-white/5 px-2 py-1 text-sm text-white outline-1 -outline-offset-1 outline-white/10"
            >
              <option value="markdown" class="bg-gray-800">{{ t('sections.type.markdown') }}</option>
              <option value="fields" :disabled="hasFieldsType() && sec.type !== 'fields'" class="bg-gray-800">{{ t('sections.type.fields') }}</option>
            </select>
            <button class="text-red-400 hover:text-red-300 text-sm" @click="deleteSectionDef(idx)">✕</button>
          </div>
          <div v-if="sec.type === 'fields'" class="space-y-2 mt-2">
            <div v-for="(field, fidx) in sec.fields" :key="field.key" class="flex gap-2">
              <input
                :value="field.label"
                :placeholder="t('sections.field.label')"
                @input="field.label = $event.target.value"
                @change="persistSectionDefs"
                class="flex-1 rounded-md bg-white/5 px-3 py-1 text-sm text-white outline-1 -outline-offset-1 outline-white/10"
              />
              <button class="text-red-400 hover:text-red-300 text-sm" @click="deleteFieldDef(sec, fidx)">✕</button>
            </div>
            <button class="text-sm text-gray-400 hover:text-white" @click="addFieldDef(sec)">{{ t('sections.field.add') }}</button>
          </div>
        </div>
        <button class="text-sm text-gray-400 hover:text-white" @click="addSection">{{ t('sections.add') }}</button>
      </div>

      <!-- Two-column layout: aside + main -->
      <div class="xl:pl-[28rem]">
        <!-- Main: Kanaltabelle -->
        <main class="px-4 py-6 sm:px-6 lg:px-8">
          <div class="flex items-center gap-3 mb-4">
            <SectionHeading :text="t('show.channels')" class="flex-1 min-w-0" />
            <span class="text-xs text-gray-500 shrink-0">{{ totalVisible }} / {{ channels.length }}</span>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full">
              <colgroup>
                <col class="w-20" />          <!-- Kanal + Farb-Badge -->
                <col class="w-[6ch]" />       <!-- Adresse -->
                <col class="w-[30ch]" />      <!-- Gerät -->
                <col />                       <!-- Notizen (rest) -->
                <col class="w-6" />           <!-- Löschen -->
              </colgroup>
              <thead>
                <tr class="border-b border-white/10">
                  <th scope="col" class="py-3 pr-3 pl-0 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{{ t('field.channel') }}</th>
                  <th scope="col" class="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{{ t('field.address') }}</th>
                  <th scope="col" class="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{{ t('field.device') }}</th>
                  <th scope="col" class="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{{ t('field.notes') }}</th>
                  <th scope="col" class="w-6"></th>
                </tr>
              </thead>
              <tbody v-for="group in groupedChannels" :key="group.position">
                <tr class="border-t border-white/5">
                  <th colspan="5" scope="colgroup" class="py-2 pr-3 pl-0 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    {{ group.position || t('channel.no_category') }}
                    <span class="ml-2 font-normal normal-case text-gray-600">{{ group.channels.length }}</span>
                  </th>
                </tr>
                <tr
                  v-for="ch in group.channels"
                  :key="ch.channel"
                  class="border-t border-white/5 group/row hover:bg-white/[0.03] transition-colors align-top"
                >
                  <td class="py-2 pr-3 pl-0">
                    <div class="flex flex-col items-start gap-1">
                      <input
                        :value="ch.channel"
                        @change="ch.channel = $event.target.value; persistChannels()"
                        class="bg-transparent focus:bg-white/5 focus:outline-none focus:ring-0 text-2xl font-bold font-mono text-white w-full px-0 border-0 leading-none"
                        style="width: 4ch"
                      />
                      <input
                        v-if="ch.color || true"
                        :value="ch.color"
                        @change="ch.color = $event.target.value; persistChannels()"
                        :placeholder="t('field.color')"
                        class="bg-white/10 focus:bg-white/15 focus:outline-none text-[10px] font-semibold text-gray-400 focus:text-white rounded-full px-2 py-0.5 border-0 w-16 text-center placeholder:text-gray-600"
                      />
                    </div>
                  </td>
                  <td class="px-3 py-2">
                    <input :value="ch.address" @change="ch.address = $event.target.value; persistChannels()" class="bg-transparent focus:bg-white/5 focus:outline-none focus:ring-0 text-sm text-gray-300 w-full px-2 border-0 h-[36px]" />
                  </td>
                  <td class="px-3 py-2">
                    <input :value="ch.device" @change="ch.device = $event.target.value; persistChannels()" class="bg-transparent focus:bg-white/5 focus:outline-none focus:ring-0 text-sm text-gray-300 w-full px-2 border-0 h-[36px]" />
                  </td>
                  <td class="px-3 py-1">
                    <textarea
                      :value="ch.notes"
                      @change="ch.notes = $event.target.value; persistChannels()"
                      class="bg-transparent focus:bg-white/5 focus:outline-none focus:ring-0 text-sm text-gray-300 w-full px-2 border-0 resize-none py-2 leading-snug [field-sizing:content] min-h-[36px]"
                    />
                  </td>
                  <td class="py-2 pl-2 pr-0 pt-3">
                    <button class="text-gray-600 hover:text-red-400 text-xs opacity-0 group-hover/row:opacity-100 transition-opacity" @click="deleteChannel(ch)" :title="t('action.delete')">✕</button>
                  </td>
                </tr>
                <tr class="border-t border-white/5">
                  <td colspan="5" class="py-2 pl-0">
                    <button type="button" class="text-sm text-gray-600 hover:text-gray-300" @click="startAdd(group.position)">+ {{ t('channel.add') }}</button>
                  </td>
                </tr>
                <tr v-if="addingPosition === group.position" class="border-t border-white/5 bg-white/5" @keydown.escape="addingPosition = null" @keydown.enter.prevent="saveAdd">
                  <td class="py-2 pr-3 pl-0">
                    <div class="flex flex-col gap-1">
                      <input autofocus class="bg-transparent focus:outline-none text-2xl font-bold font-mono text-white px-0 border-0 leading-none" style="width:4ch" v-model="addForm.channel" :placeholder="t('show.channel.nr')" />
                      <input class="bg-white/10 focus:bg-white/15 focus:outline-none text-[10px] font-semibold text-gray-400 rounded-full px-2 py-0.5 border-0 w-16 text-center placeholder:text-gray-600" v-model="addForm.color" :placeholder="t('field.color')" />
                    </div>
                  </td>
                  <td class="px-3 py-2"><input class="bg-transparent focus:outline-none text-sm text-gray-300 w-full px-2" v-model="addForm.address" :placeholder="t('show.channel.address.example')" /></td>
                  <td class="px-3 py-2"><input class="bg-transparent focus:outline-none text-sm text-gray-300 w-full px-2" v-model="addForm.device" /></td>
                  <td class="px-3 py-2"><textarea class="bg-transparent focus:outline-none text-sm text-gray-300 w-full px-2 resize-none [field-sizing:content] min-h-[36px]" v-model="addForm.notes" /></td>
                  <td class="py-2 pl-2 pr-0"><button class="text-green-400 hover:text-green-300 text-sm" @click="saveAdd">✓</button></td>
                </tr>
              </tbody>
              <tbody v-if="groupedChannels.length === 0">
                <tr v-if="addingPosition === ''" class="border-t border-white/5 bg-white/5" @keydown.escape="addingPosition = null" @keydown.enter.prevent="saveAdd">
                  <td class="py-2 pr-3 pl-0"><input autofocus class="bg-transparent focus:outline-none text-sm text-white w-full px-0" v-model="addForm.channel" :placeholder="t('show.channel.nr')" /></td>
                  <td class="px-3 py-2"><input class="bg-transparent focus:outline-none text-sm text-gray-300 w-full px-2" v-model="addForm.address" :placeholder="t('show.channel.address.example')" /></td>
                  <td class="px-3 py-2"><input class="bg-transparent focus:outline-none text-sm text-gray-300 w-full px-2" v-model="addForm.device" /></td>
                  <td class="px-3 py-2"><ColorPicker v-model="addForm.color" /></td>
                  <td class="px-3 py-2"><textarea class="bg-transparent focus:outline-none text-sm text-gray-300 w-full px-2 resize-none [field-sizing:content] min-h-[36px]" v-model="addForm.notes" /></td>
                  <td class="py-2 pl-2 pr-0"><button class="text-green-400 hover:text-green-300 text-sm" @click="saveAdd">✓</button></td>
                </tr>
                <tr v-else class="border-t border-white/5">
                  <td colspan="5" class="py-4 pl-0">
                    <span class="text-sm text-gray-500">{{ t('channel.list.empty') }}</span>
                    <button type="button" class="ml-3 text-sm text-gray-400 hover:text-white" @click="startAdd('')">+ {{ t('channel.add') }}</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </main>
      </div>

      <!-- Aside: Sections + Fotos (fixed, left of main) -->
      <aside class="fixed top-16 bottom-0 left-20 hidden w-[28rem] overflow-y-auto border-r border-white/10 px-4 py-6 sm:px-6 xl:block">
        <!-- Custom Sections -->
        <template v-if="sortedSections.length > 0">
          <section v-for="sec in sortedSections" :key="sec.id" class="mb-8">
            <SectionHeading :text="sec.title" class="mb-4" />
            <div v-if="sec.type === 'fields'" class="divide-y divide-white/5">
              <div v-for="field in sec.fields" :key="field.key" class="flex items-center h-[40px]">
                <label class="w-28 text-sm text-gray-500 shrink-0">{{ field.label }}</label>
                <input
                  :value="parseFieldValue(sec.id, field.key)"
                  @change="onFieldChange(sec.id, field.key, $event.target.value)"
                  class="flex-1 bg-transparent border-0 border-b border-white/10 focus:border-accent focus:outline-none text-sm text-white h-full px-2 transition-colors"
                />
              </div>
            </div>
            <MarkdownEditor
              v-else
              :modelValue="sectionContents.get(sec.id) ?? ''"
              @update:modelValue="onSectionChange(sec.id, $event)"
            />
          </section>
        </template>

        <!-- Fallback: single setup editor -->
        <section v-else class="mb-8">
          <SectionHeading :text="t('show.setup')" class="mb-4" />
          <MarkdownEditor v-model="setupMarkdown" @update:modelValue="onSetupChange" />
        </section>

        <!-- Foto-Galerie -->
        <section>
          <div class="flex items-center gap-3 mb-4">
            <SectionHeading :text="t('show.photos')" class="flex-1 min-w-0" />
            <label class="cursor-pointer text-sm text-gray-400 hover:text-white shrink-0">
              + {{ t('photo.add') }}
              <input type="file" accept="image/*" multiple class="sr-only" @change="onFileInput" />
            </label>
          </div>
          <div
            :class="{ 'ring-2 ring-accent ring-inset rounded-lg': dragging }"
            @dragover.prevent="dragging = true"
            @dragleave="dragging = false"
            @drop.prevent="onDrop"
          >
            <p v-if="photos.length === 0 && !dragging" class="text-sm text-gray-500">{{ t('photo.empty') }}</p>
            <ul role="list" class="grid grid-cols-3 gap-2">
              <li v-for="filename in photos" :key="filename" class="relative group">
                <div class="aspect-square block w-full overflow-hidden rounded-lg bg-gray-800 cursor-pointer" @click="openLightbox(filename)">
                  <img :src="getPhotoUrl(props.id, filename)" :alt="filename" class="pointer-events-none object-cover group-hover:opacity-75 w-full h-full" />
                </div>
                <button
                  type="button"
                  class="absolute top-1 right-1 rounded bg-black/60 px-1 py-0.5 text-xs text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                  @click="onDeletePhoto(filename)"
                  :title="t('action.delete')"
                >✕</button>
              </li>
            </ul>
          </div>
        </section>
      </aside>
    </template>

    <!-- Lightbox -->
    <div v-if="lightboxPhoto" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80" @click="lightboxPhoto = null">
      <img :src="getPhotoUrl(props.id, lightboxPhoto)" class="max-h-screen max-w-screen-lg object-contain" @click.stop />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useLocale } from '../composables/useLocale.js'
import MarkdownEditor from '../components/MarkdownEditor.vue'
import SectionHeading from '../components/SectionHeading.vue'
import { MagnifyingGlassIcon } from '@heroicons/vue/20/solid'
import { fetchShow, updateContent } from '../api/shows.js'
import { fetchChannels, saveChannels } from '../api/channels.js'
import { fetchPhotos, uploadPhoto, deletePhoto, getPhotoUrl } from '../api/photos.js'
import { subscribeChannels } from '../api/client.js'
import { api } from '../api/client.js'
import ColorPicker from '../components/ColorPicker.vue'
import { fetchShowSections, saveShowSections, parseSectionsMd, serializeSectionsMd, fetchShowSectionDefs, saveShowSectionDefs } from '../api/sections.js'
import { uuid } from '../utils/uuid.js'

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
const editingSections = ref(false)
let saveSectionsTimer = null

const sortedSections = computed(() =>
  [...sectionDefs.value].sort((a, b) => a.order - b.order)
)

// ── Editor ─────────────────────────────────────────────────────────────────
let saveSetupTimer = null
let pendingSetupMd = null

function onSetupChange(md) {
  pendingSetupMd = md
  clearTimeout(saveSetupTimer)
  saveSetupTimer = setTimeout(() => { persistSetup(md); saveSetupTimer = null }, 800)
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

// ── Kanal löschen ──────────────────────────────────────────────────────────
async function deleteChannel(ch) {
  if (!window.confirm(t('show.channel.delete.confirm', { channel: ch.channel }))) return
  channels.value = channels.value.filter(c => c.channel !== ch.channel)
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
    channelsSaveTimer = null
    try { await saveChannels(props.id, channels.value) }
    finally { channelsSaving.value = false }
  }, 400)
}

// ── Fotos ──────────────────────────────────────────────────────────────────
const dragging = ref(false)
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
  if (!window.confirm(t('show.photo.delete.confirm'))) return
  await deletePhoto(props.id, filename)
  photos.value = photos.value.filter(f => f !== filename)
}

function openLightbox(filename) {
  lightboxPhoto.value = filename
}

// ── Sections ───────────────────────────────────────────────────────────────

function onSectionChange(id, value) {
  sectionContents.value = new Map(sectionContents.value)
  sectionContents.value.set(id, value)
  clearTimeout(saveSectionsTimer)
  saveSectionsTimer = setTimeout(() => { persistSections(); saveSectionsTimer = null }, 800)
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
  for (const line of raw.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx !== -1 && line.slice(0, colonIdx).trim() === key) {
      return line.slice(colonIdx + 1).trim()
    }
  }
  return ''
}

function onFieldChange(sectionId, key, value) {
  const raw = sectionContents.value.get(sectionId) ?? ''
  const lines = raw ? raw.split('\n') : []
  const idx = lines.findIndex(l => {
    const colonIdx = l.indexOf(':')
    return colonIdx !== -1 && l.slice(0, colonIdx).trim() === key
  })
  if (idx !== -1) {
    lines[idx] = `${key}: ${value}`
  } else {
    lines.push(`${key}: ${value}`)
  }
  onSectionChange(sectionId, lines.join('\n'))
}

// ── Section Defs verwalten ─────────────────────────────────────────────────

async function persistSectionDefs() {
  await saveShowSectionDefs(props.id, sectionDefs.value)
}

function addSection() {
  sectionDefs.value.push({
    id: uuid(),
    title: '',
    type: 'markdown',
    order: sectionDefs.value.length,
    fields: []
  })
  persistSectionDefs()
}

function deleteSectionDef(idx) {
  sectionDefs.value.splice(idx, 1)
  sectionDefs.value.forEach((s, i) => s.order = i)
  persistSectionDefs()
}

function moveSectionDef(idx, dir) {
  const arr = sectionDefs.value
  const swap = idx + dir
  if (swap < 0 || swap >= arr.length) return
  ;[arr[idx], arr[swap]] = [arr[swap], arr[idx]]
  arr.forEach((s, i) => s.order = i)
  persistSectionDefs()
}

function addFieldDef(section) {
  section.fields.push({ key: uuid().slice(0, 8), label: '' })
  persistSectionDefs()
}

function deleteFieldDef(section, idx) {
  section.fields.splice(idx, 1)
  persistSectionDefs()
}

function hasFieldsType() {
  return sectionDefs.value.some(s => s.type === 'fields')
}

function onSectionTypeChange(section, newType) {
  if (newType === 'fields' && hasFieldsType() && section.type !== 'fields') return
  section.type = newType
  if (newType === 'fields' && !section.fields) section.fields = []
  persistSectionDefs()
}

// ── Laden ──────────────────────────────────────────────────────────────────
let unsubscribeSSE = null

onMounted(async () => {
  try {
    const [showData, chs, photoList, sectionsData, defs] = await Promise.all([
      fetchShow(props.id),
      fetchChannels(props.id),
      fetchPhotos(props.id),
      fetchShowSections(props.id),
      fetchShowSectionDefs(props.id),
    ])

    meta.value = parseFrontmatter(showData.content)
    setupMarkdown.value = parseSetupSection(showData.content)
    channels.value = chs
    photos.value = photoList

    sectionContents.value = parseSectionsMd(sectionsData?.raw)
    sectionDefs.value = Array.isArray(defs) ? defs : []
  } catch (e) {
    console.error('Ladefehler:', e)
  } finally {
    loading.value = false
  }

  // SSE für Realtime-Updates von anderen Nutzern
  unsubscribeSSE = subscribeChannels(props.id, async () => {
    channels.value = await fetchChannels(props.id)
  })

  // Scroll-Position wiederherstellen
  const scrollKey = `scroll_${props.id}`
  const saved = sessionStorage.getItem(scrollKey)
  if (saved) {
    await nextTick()
    window.scrollTo({ top: parseInt(saved), behavior: 'instant' })
  }
  window.addEventListener('scroll', () => {
    sessionStorage.setItem(scrollKey, window.scrollY)
  }, { passive: true })
})

onBeforeUnmount(() => {
  unsubscribeSSE?.()
  if (saveSetupTimer) { clearTimeout(saveSetupTimer); persistSetup(pendingSetupMd) }
  if (channelsSaveTimer) { clearTimeout(channelsSaveTimer); persistChannels() }
  if (saveSectionsTimer) { clearTimeout(saveSectionsTimer); persistSections() }
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
