<template>
  <div>
    <!-- Top Header -->
    <ShowHeader
      v-model="mobileTab"
      v-model:search="search"
      :showName="meta.name"
      :showDate="meta.datum"
      :canUndo="canUndo"
      :canRedo="canRedo"
      :saving="channelsSaving || sectionsSaving || setupSaving"
      :presence="presence"
      :dupAddressWarning="dupWarning"
      :dupChannelWarning="dupChannelWarning"
      :labels="{
        back: t('action.back'),
        tabChannels: t('tab.channels'),
        tabInfo: t('tab.info'),
        tabFloorplan: t('tab.floorplan'),
        undo: t('action.undo'),
        redo: t('action.redo'),
        dupAddress: t('channel.dup_address'),
        dupChannel: t('channel.dup_channel'),
        search: t('channel.search'),
        history: t('history.btn'),
        import: t('nav.import'),
        export: t('nav.export'),
        eosImport: t('eos.import.button'),
        csvImport: t('channel.import'),
        pdf: t('show.pdf'),
        csvExport: t('channel.export'),
      }"
      @back="router.push('/')"
      @undo="undo()"
      @redo="redo()"
      @openHistory="openHistory()"
      @openPdf="openPdf()"
      @downloadCsv="downloadChannelsCsv(props.id, channels)"
      @eosFileSelected="onEosFileSelected($event)"
      @csvFileSelected="onCsvImportSelected($event)"
    />

    <div v-if="loading" class="flex items-center justify-center h-64 text-sm text-gray-400">…</div>

    <div v-else :inert="!isOnline || undefined" :class="{ 'opacity-40 pointer-events-none select-none': !isOnline }">
      <!-- Two-column layout: aside + main -->
      <div :class="mobileTab !== 'channels' && mobileTab !== 'info' ? 'hidden' : mobileTab !== 'channels' ? 'hidden xl:block' : ''" class="xl:pl-[28rem] xl:ml-0 h-[calc(100vh-4rem)] overflow-y-auto">
        <!-- Main: Kanaltabelle -->
        <main class="px-4 py-6 sm:px-6 lg:px-8 min-h-full">
          <div class="flex items-center gap-3 mb-4">
            <SectionHeading :text="t('show.channels')" class="flex-1 min-w-0" />
            <span class="text-xs text-gray-500 shrink-0">{{ totalVisible }} / {{ channels.length }}</span>
          </div>
          <ChannelTable
            :channels="channels"
            :groupedChannels="groupedChannels"
            :dupChannelNrs="dupChannelNrs"
            :channelStatusFn="channelStatus"
            :toggleChannelStatusFn="toggleChannelStatus"
            :onKeydownFn="onKeydown"
            :labels="{
              channel: t('field.channel'),
              color: t('field.color'),
              device: t('field.device'),
              notes: t('field.notes'),
              editPosition: t('channel.position.edit'),
              noCategory: t('channel.no_category'),
              add: t('channel.add'),
              delete: t('action.delete'),
              empty: t('channel.list.empty'),
              channelNr: t('show.channel.nr'),
              addressExample: t('show.channel.address.example'),
            }"
            @change="scheduleChannelsSave()"
            @recordFocus="recordFocus()"
            @commitFocus="commitFocus()"
            @pushSnapshot="pushSnapshot()"
            @deleteChannel="deleteChannel($event)"
            @reorder="channels.splice(0, channels.length, ...$event)"
          />
        </main>
      </div>

      <!-- Grundriss-Tab -->
      <div v-if="mobileTab === 'floorplan'" class="h-[calc(100vh-4rem)]">
        <FloorplanEditor
          :image-url="floorplan.image_url ? api.url(floorplan.image_url) : null"
          :initial-canvas-data="floorplan.canvas_data"
          :channels="channels"
          @change="onFloorplanChange"
          @upload-image="onFloorplanImageUpload"
          @delete-image="onFloorplanImageDelete"
          @jump-to-channel="jumpToChannel"
        />
      </div>

      <!-- Aside: Sections + Fotos (fixed, left of main) -->
      <aside :class="mobileTab === 'floorplan' ? 'hidden' : mobileTab !== 'info' ? 'hidden xl:block' : ''" class="xl:fixed xl:top-16 xl:bottom-0 xl:left-20 xl:w-[28rem] xl:overflow-y-auto xl:border-r xl:border-white/10 px-4 py-6 sm:px-6 border-b border-white/10 xl:border-b-0">

        <!-- Sections (inline editor) -->
        <SectionEditor
          :showId="props.id"
          :sectionDefs="sectionDefs"
          :sectionContents="sectionContents"
          :setupMarkdown="setupMarkdown"
          :labels="{
            titlePlaceholder: t('sections.title.placeholder'),
            fieldLabel: t('sections.field.label'),
            fieldAdd: t('sections.field.add'),
            addMarkdown: t('sections.add.markdown'),
            addFields: t('sections.add.fields'),
          }"
          @update:sectionDefs="sectionDefs = $event"
          @update:sectionContents="sectionContents = $event"
          @update:setupMarkdown="onSetupChange($event)"
          @pushSnapshot="pushSnapshot"
          @sectionChange="persistSectionsDebounced"
        >
          <template #setup-heading>
            <SectionHeading :text="t('show.setup')" class="mb-4" />
          </template>
        </SectionEditor>

        <!-- Foto-Galerie -->
        <PhotoGallery
          :showId="props.id"
          :photos="photos"
          :labels="{
            add: t('photo.add'),
            empty: t('photo.empty'),
            delete: t('action.delete'),
            captionPlaceholder: t('photo.caption.placeholder'),
            channelLabel: 'Kanal:',
            channelPlaceholder: 'z. B. 42',
          }"
          @update:photos="photos = $event"
        >
          <template #heading>
            <SectionHeading :text="t('show.photos')" class="flex-1 min-w-0" />
          </template>
        </PhotoGallery>
      </aside>
    </div>

    <HistorySlideOver
      :open="historyOpen"
      :showId="props.id"
      :labels="{
        title: t('history.title'),
        back: t('history.back'),
        empty: t('history.empty'),
        restore: t('history.restore'),
        channelCount: (n) => t('history.channel_count', { n }),
      }"
      @close="historyOpen = false"
      @restore="doRestoreHistory($event)"
    />

    <!-- EOS Merge Vorschau -->
    <EosMergePreviewDialog
      :open="eosMergePreview.open"
      :newActive="eosMergePreview.newActive"
      :nowGone="eosMergePreview.nowGone"
      :untouched="eosMergePreview.untouched"
      @confirm="resolveEosMergePreview(true)"
      @cancel="resolveEosMergePreview(false)"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useRouter } from 'vue-router'
import { useLocale } from '../composables/useLocale.js'
import { useConfirm } from '../composables/useConfirm.js'
import { useKeyboardNav } from '../composables/useKeyboardNav.js'
import SectionHeading from '../components/SectionHeading.vue'
import { useUndoRedo } from '../composables/useUndoRedo.js'
import ShowHeader from '../components/show/ShowHeader.vue'
import { fetchShow, updateMeta, restoreHistory, createSnapshot } from '../api/shows.js'
import { fetchChannels, saveChannels, downloadChannelsCsv, parseChannelsCsv, mergeChannels } from '../api/channels.js'
import { fetchPhotos } from '../api/photos.js'
import PhotoGallery from '../components/show/PhotoGallery.vue'
import HistorySlideOver from '../components/show/HistorySlideOver.vue'
import { subscribeShow, isOnline } from '../api/client.js'
import { api } from '../api/client.js'
import { fetchShowSections, saveShowSections, fetchShowSectionDefs } from '../api/sections.js'
import ChannelTable from '../components/channel/ChannelTable.vue'
import SectionEditor from '../components/show/SectionEditor.vue'
import EosMergePreviewDialog from '../components/EosMergePreviewDialog.vue'
import FloorplanEditor from '../components/FloorplanEditor.vue'
import { fetchShowFloorplan, saveShowFloorplan, uploadShowFloorplanImage, deleteShowFloorplanImage } from '../api/floorplan.js'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()
const { t } = useLocale()
const { confirm } = useConfirm()
const { onKeydown } = useKeyboardNav()

// ── State ──────────────────────────────────────────────────────────────────
const loading = ref(true)
const meta = ref({})          // frontmatter: name, datum, venue, …
const setupMarkdown = ref('') // Aufbau-Abschnitt aus .md-Datei
const eosActiveChannels = ref(null) // null = noch kein Import; Array<string> (neg. Prefix = inaktiv)
const eosMergePreview = ref({ open: false, newActive: [], nowGone: [], untouched: [] })
let _eosMergeResolve = null
const channels = ref([])
const photos = ref([])

const historyOpen = ref(false)
const search = ref('')
const setupSaving = ref(false)
const channelsSaving = ref(false)

const mobileTab = ref('channels') // 'channels' | 'info' | 'floorplan'

const floorplan = ref({ image_url: null, canvas_data: null })
let floorplanSaveTimer = null

const sectionDefs = ref([])
const sectionContents = ref(new Map())
const sectionsSaving = ref(false)

// ── Undo/Redo ──────────────────────────────────────────────────────────────
const { initSnapshot, recordFocus, commitFocus, pushSnapshot, undo, redo, canUndo, canRedo } =
  useUndoRedo(
    // getState
    () => ({
      channels: channels.value,
      sectionContents: [...sectionContents.value.entries()],
      sectionDefs: sectionDefs.value,
      meta: meta.value,
      setupMarkdown: setupMarkdown.value,
    }),
    // applyState
    (snap) => {
      channels.value = snap.channels
      sectionContents.value = new Map(snap.sectionContents)
      sectionDefs.value = snap.sectionDefs
      meta.value = snap.meta
      setupMarkdown.value = snap.setupMarkdown
    },
    // cancelPendingSaves
    () => {
      persistChannels.cancel()
      persistSetupDebounced.cancel()
      persistSectionsDebounced.cancel()
    },
    // saveNow
    () => {
      persistChannels()
      persistSetup(setupMarkdown.value)
      persistSections()
    },
    // storageKey
    `undoredo-${props.id}`
  )

function onUndoRedoKeydown(e) {
  const focused = document.activeElement
  const isEditing = focused && (
    focused.tagName === 'INPUT' ||
    focused.tagName === 'TEXTAREA' ||
    focused.isContentEditable
  )
  if (isEditing) return

  const isMac = navigator.userAgentData?.platform === 'macOS' || /Mac/.test(navigator.userAgent)
  const mod = isMac ? e.metaKey : e.ctrlKey

  if (mod && !e.shiftKey && e.key === 'z') {
    e.preventDefault()
    undo()
  } else if (
    (mod && e.shiftKey && e.key === 'z') ||
    (mod && e.shiftKey && e.key === 'Z') ||
    (!isMac && mod && e.key === 'y')
  ) {
    e.preventDefault()
    redo()
  }
}

// ── Editor ─────────────────────────────────────────────────────────────────
let pendingSetupMd = null

const persistSetupDebounced = useDebounceFn(async () => {
  setupSaving.value = true
  try {
    await updateMeta(props.id, { ...meta.value, setupMarkdown: pendingSetupMd })
  } finally {
    setupSaving.value = false
  }
}, 50)

function onSetupChange(md) {
  recordFocus()
  pendingSetupMd = md
  setupSaving.value = true
  persistSetupDebounced()
  nextTick(() => commitFocus())
}

async function persistSetup(md) {
  setupSaving.value = true
  try {
    await updateMeta(props.id, { ...meta.value, setupMarkdown: md })
  } finally {
    setupSaving.value = false
  }
}

async function persistEosChannels() {
  await updateMeta(props.id, { ...meta.value, setupMarkdown: setupMarkdown.value, eosActiveChannels: eosActiveChannels.value })
}

async function onEosFileSelected(e) {
  const file = e.target.files?.[0]
  if (!file) return
  e.target.value = '' // Reset: dieselbe Datei kann erneut gewählt werden

  const text = await file.text()
  const { activeChannels, error } = parseEosCsv(text)

  if (error) {
    window.alert(t(error))
    return
  }

  // Merge-Vorschau berechnen
  const channelsWithNotes = new Set(
    channels.value.filter(ch => (ch.notes ?? '').trim().length > 0).map(ch => String(ch.channel))
  )

  // Hilfsfunktion: Kanal-Nr → Label (device oder position, falls vorhanden)
  function chLabel(nr) {
    const ch = channels.value.find(c => String(c.channel) === nr)
    if (!ch) return ''
    return [ch.device, ch.position].filter(Boolean).join(' / ')
  }

  const prev = eosActiveChannels.value ?? []
  const prevTracked = prev.map(ch => ch.startsWith('-') ? ch.slice(1) : ch)
    .filter(nr => !channelsWithNotes.has(nr))

  const newActiveNrs  = activeChannels.filter(nr => !channelsWithNotes.has(nr))
  const nowGoneNrs    = prevTracked.filter(nr => !activeChannels.includes(nr))
  const untouchedNrs  = activeChannels.filter(nr => channelsWithNotes.has(nr))

  // Preview-Dialog öffnen und auf Bestätigung warten
  const ok = await new Promise(resolve => {
    _eosMergeResolve = resolve
    eosMergePreview.value = {
      open: true,
      newActive:  newActiveNrs.map(nr => ({ nr, label: chLabel(nr) })),
      nowGone:    nowGoneNrs.map(nr => ({ nr, label: chLabel(nr) })),
      untouched:  untouchedNrs.map(nr => ({ nr, label: chLabel(nr) })),
    }
  })
  eosMergePreview.value.open = false
  if (!ok) return

  // Option 1: fehlende Kanäle automatisch anlegen
  const existingNrs = new Set(channels.value.map(ch => String(ch.channel)))
  const missingNrs = newActiveNrs.filter(nr => !existingNrs.has(nr))
  if (missingNrs.length > 0) {
    const newChannels = missingNrs.map(nr => ({ channel: nr, address: '', device: '', position: '', color: '', notes: '' }))
    channels.value = [...channels.value, ...newChannels]
      .sort((a, b) => parseInt(a.channel) - parseInt(b.channel))
    await saveChannels(props.id, channels.value)
  }

  // Import durchführen
  eosActiveChannels.value = [
    ...newActiveNrs,
    ...nowGoneNrs.map(nr => `-${nr}`),
  ]
  await persistEosChannels()
}

function resolveEosMergePreview(value) {
  _eosMergeResolve?.(value)
  _eosMergeResolve = null
}

function channelStatus(ch) {
  const notes = (ch.notes ?? '').trim()
  if (notes.length > 0) return 'active'   // grün — Notizen vorhanden
  const nr = String(ch.channel)
  if (!eosActiveChannels.value) return 'default'
  if (eosActiveChannels.value.includes(nr)) return 'eos'        // gelb — Eos aktiv, keine Notizen
  if (eosActiveChannels.value.includes(`-${nr}`)) return 'default'  // grau — manuell inaktiv
  return 'default'
}

async function toggleChannelStatus(ch) {
  if (!eosActiveChannels.value) return
  const nr = String(ch.channel)
  const status = channelStatus(ch)
  if (status === 'active') return  // grün = durch Notizen gesteuert, kein Toggle

  if (status === 'eos') {
    // Gelb → Grau: deaktivieren
    eosActiveChannels.value = eosActiveChannels.value.map(c => c === nr ? `-${nr}` : c)
  } else {
    // Grau → Gelb: reaktivieren (nur wenn Kanal bekannt in eosActiveChannels)
    const hasInactive = eosActiveChannels.value.includes(`-${nr}`)
    if (hasInactive) {
      eosActiveChannels.value = eosActiveChannels.value.map(c => c === `-${nr}` ? nr : c)
    }
    // Wenn Kanal gar nicht in eosActiveChannels: kein Toggle möglich
  }
  await persistEosChannels()
}

// ── History ─────────────────────────────────────────────────────────────────
function openHistory() {
  historyOpen.value = true
}

async function doRestoreHistory(entry) {
  pushSnapshot()
  await restoreHistory(props.id, entry.id)
  const [chs, sections] = await Promise.all([
    fetchChannels(props.id),
    fetchShowSections(props.id),
  ])
  channels.value = Array.isArray(chs) ? chs : []
  for (const { id, content } of (Array.isArray(sections) ? sections : [])) {
    sectionContents.value.set(id, content)
  }
  historyOpen.value = false
}

// ── Kanal CSV Import ───────────────────────────────────────────────────────
function onCsvImportSelected(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = e => {
    const imported = parseChannelsCsv(e.target.result)
    if (imported.length === 0) return
    pushSnapshot()
    channels.value = mergeChannels(channels.value, imported)
    scheduleChannelsSave()
  }
  reader.readAsText(file)
  event.target.value = ''
}

// ── Eos CSV Parser ─────────────────────────────────────────────────────────
function parseEosCsv(text) {
  const lines = text.split(/\r?\n/)
  if (lines[0].trim() !== 'START_LEVELS') {
    return { activeChannels: null, error: 'eos.import.error.invalid' }
  }
  const headerIdx = lines.findIndex(l => l.startsWith('TARGET_TYPE,'))
  if (headerIdx === -1) return { activeChannels: null, error: 'eos.import.error.parse' }
  const headers = lines[headerIdx].split(',')
  const colChannel   = headers.indexOf('CHANNEL')
  const colParamType = headers.indexOf('PARAMETER_TYPE_AS_TEXT')
  const colLevel     = headers.indexOf('LEVEL')
  if (colChannel === -1 || colParamType === -1 || colLevel === -1) {
    return { activeChannels: null, error: 'eos.import.error.parse' }
  }
  const active = new Set()
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols[colParamType] === 'Intens' && parseFloat(cols[colLevel]) > 0) {
      const ch = (cols[colChannel] ?? '').trim()
      if (ch) active.add(ch)
    }
  }
  return { activeChannels: [...active], error: null }
}

// ── PDF ────────────────────────────────────────────────────────────────────
async function openPdf() {
  const url = await api.downloadUrl(`/api/shows/${props.id}/pdf`)
  window.open(url, '_blank')
}

// ── Kanal-Duplikat-Warnung ─────────────────────────────────────────────────
const dupWarning = computed(() => {
  const addresses = channels.value.map(c => c.address).filter(Boolean)
  return addresses.length !== new Set(addresses).size
})

const dupChannelNrs = computed(() => {
  const seen = new Set()
  const dups = new Set()
  for (const ch of channels.value) {
    if (ch.channel && seen.has(ch.channel)) dups.add(ch.channel)
    seen.add(ch.channel)
  }
  return dups
})

const dupChannelWarning = computed(() => dupChannelNrs.value.size > 0)

// ── Kanäle gruppiert ───────────────────────────────────────────────────────
const groupedChannels = computed(() => {
  const q = search.value.toLowerCase()
  // Bei aktivem Suchfilter numerisch sortieren, sonst Reihenfolge aus channels.value beibehalten
  let chs = q
    ? [...channels.value].sort((a, b) => parseInt(a.channel) - parseInt(b.channel))
    : [...channels.value]
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
  const ok = await confirm({ t, titleKey: 'show.channel.delete.confirm', messageParams: { channel: ch.channel }, confirmKey: 'action.delete', cancelKey: 'action.cancel' })
  if (!ok) return
  pushSnapshot()
  channels.value = channels.value.filter(c => c.channel !== ch.channel)
  scheduleChannelsSave()
}

// ── Kanäle speichern ───────────────────────────────────────────────────────
let ignoreSseCount = 0   // Anzahl eigener Saves die noch kein SSE-Echo hatten
const persistChannels = useDebounceFn(async () => {
  ignoreSseCount++
  try { await saveChannels(props.id, channels.value) }
  finally { channelsSaving.value = false }
}, 50)

function scheduleChannelsSave() {
  channelsSaving.value = true
  persistChannels()
}

// ── Sections ───────────────────────────────────────────────────────────────

let ignoreSectionsSseCount = 0
const persistSectionsDebounced = useDebounceFn(async () => {
  sectionsSaving.value = true
  ignoreSectionsSseCount++
  try {
    const sections = [...sectionContents.value.entries()].map(([id, content]) => ({ id, content }))
    await saveShowSections(props.id, sections)
  } finally {
    sectionsSaving.value = false
  }
}, 50)

async function persistSections() {
  sectionsSaving.value = true
  ignoreSectionsSseCount++
  try {
    const sections = [...sectionContents.value.entries()].map(([id, content]) => ({ id, content }))
    await saveShowSections(props.id, sections)
  } finally {
    sectionsSaving.value = false
  }
}

async function loadFloorplan() {
  const data = await fetchShowFloorplan(props.id).catch(() => null)
  if (data) floorplan.value = data
}

function onFloorplanChange(canvasData) {
  floorplan.value = { ...floorplan.value, canvas_data: canvasData }
  saveShowFloorplan(props.id, canvasData).catch(() => {})
}

async function onFloorplanImageUpload(file) {
  const result = await uploadShowFloorplanImage(props.id, file)
  if (result?.image_url) {
    floorplan.value = { ...floorplan.value, image_url: result.image_url }
  }
}

async function onFloorplanImageDelete() {
  await deleteShowFloorplanImage(props.id)
  floorplan.value = { ...floorplan.value, image_url: null }
}

function jumpToChannel(channelNum) {
  mobileTab.value = 'channels'
}


// ── Laden ──────────────────────────────────────────────────────────────────
let unsubscribeSSE = null
let snapshotInterval = null
const presence = ref([]) // [{ username, devices }]

onMounted(async () => {
  try {
    const [showData, chs, photoList, sections, defs] = await Promise.all([
      fetchShow(props.id),
      fetchChannels(props.id),
      fetchPhotos(props.id),
      fetchShowSections(props.id),
      fetchShowSectionDefs(props.id),
    ])

    meta.value = { name: showData.name, datum: showData.datum, template: showData.template, untertitel: showData.untertitel, spielzeit: showData.spielzeit }
    setupMarkdown.value = showData.setupMarkdown ?? ''
    eosActiveChannels.value = showData.eosActiveChannels ?? null
    channels.value = Array.isArray(chs) ? chs : []
    photos.value = photoList

    sectionContents.value = new Map((Array.isArray(sections) ? sections : []).map(s => [s.id, s.content]))
    sectionDefs.value = Array.isArray(defs) ? defs : []
  } catch (e) {
    console.error('Ladefehler:', e)
  } finally {
    loading.value = false
  }

  // Initialer Snapshot: sauberer Ausgangspunkt für Undo, löscht alte sessionStorage-History
  // Außerhalb des try-Blocks damit er immer ausgeführt wird (auch bei teilweisem Ladefehler)
  initSnapshot()
  // Server-seitiger Snapshot beim Öffnen + alle 10 Minuten (fire-and-forget)
  createSnapshot(props.id).catch(() => {})
  snapshotInterval = setInterval(() => createSnapshot(props.id).catch(() => {}), 10 * 60 * 1000)

  // Floorplan laden
  loadFloorplan().catch(() => {})

  // SSE — gemeinsame Verbindung für Channels, Sections und Presence
  unsubscribeSSE = subscribeShow(props.id, {
    onChannels: async () => {
      if (ignoreSseCount > 0) { ignoreSseCount--; return }
      channels.value = await fetchChannels(props.id)
    },
    onSections: async () => {
      if (ignoreSectionsSseCount > 0) { ignoreSectionsSseCount--; return }
      const sections = await fetchShowSections(props.id)
      for (const { id, content } of (Array.isArray(sections) ? sections : [])) {
        sectionContents.value.set(id, content)
      }
    },
    onPresence: ({ users }) => {
      presence.value = users
    },
  })

  // Drag & Drop initialisieren
  await nextTick()

  // Scroll-Position wiederherstellen
  const scrollKey = `scroll_${props.id}`
  const saved = sessionStorage.getItem(scrollKey)
  if (saved) {
    await nextTick()
    window.scrollTo({ top: parseInt(saved), behavior: 'instant' })
  }
  const onScroll = () => sessionStorage.setItem(scrollKey, window.scrollY)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('keydown', onUndoRedoKeydown)
  onBeforeUnmount(() => {
    window.removeEventListener('scroll', onScroll)
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onUndoRedoKeydown)
  unsubscribeSSE?.()
  clearInterval(snapshotInterval)
  persistSetupDebounced.flush()
  persistChannels.flush()
  persistSectionsDebounced.flush()
  if (floorplanSaveTimer) { clearTimeout(floorplanSaveTimer) }
})

</script>
