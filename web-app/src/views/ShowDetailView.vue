<template>
  <div class="flex flex-col h-dvh bg-background overflow-hidden">

    <!-- ── Top Navigation Bar ─────────────────────────────────────────────── -->
    <!-- Skeleton während Laden -->
    <div v-if="loading" class="sticky top-0 z-40 flex flex-col border-b border-border bg-background">
      <div class="flex h-16 shrink-0 items-center gap-x-4 px-4 sm:px-6 lg:px-8">
        <div class="h-5 w-40 rounded bg-muted animate-pulse" />
        <div class="h-4 w-24 rounded bg-muted animate-pulse" />
      </div>
      <div class="flex h-10 items-center border-t border-border/50 bg-muted/50" />
    </div>
    <ShowHeader
      v-else
      v-model="mobileTab"
      v-model:search="search"
      :showName="meta.name"
      :showDate="showDateFormatted"
      :canUndo="canUndo"
      :canRedo="canRedo"
      :saving="channelsSaving || sectionsSaving || setupSaving"
      :presence="presence"
      :dupAddressWarning="dupWarning"
      :dupChannelWarning="dupChannelWarning"
      :healthStats="healthStats"
      :healthLabels="healthLabels"
      :activeHealthFilter="healthFilter"
      :labels="{
        tabChannels: t('tab.channels'),
        tabPhotos: t('tab.photos'),
        tabFloorplan: t('tab.floorplan'),
        tabGassenturm: t('tab.gassenturm'),
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
      @update:showName="onRenameShow($event)"
      @undo="undo()"
      @redo="redo()"
      @openHistory="openHistory()"
      @openPdf="openPdf()"
      @downloadCsv="downloadChannelsCsv(props.id, channels)"
      @eosFileSelected="onEosFileSelected($event)"
      @csvFileSelected="onCsvImportSelected($event)"
      @healthFilter="onHealthFilter($event)"
    >
      <template v-if="mobileTab === 'gassenturm'" #subnav>
        <button
          v-for="sub in aufbauSubTabs"
          :key="sub.key"
          :class="[
            'text-sm px-3 py-1.5 rounded-md font-medium transition-colors',
            aufbauTab === sub.key
              ? 'bg-accent/15 text-accent'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          ]"
          @click="aufbauTab = sub.key"
        >{{ sub.label }}</button>
        <button
          class="text-xs px-3 py-1.5 rounded-md font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/40"
          @click="addSectionFromSubtab"
        >+</button>
      </template>
    </ShowHeader>

    <!-- ── Loading ────────────────────────────────────────────────────────── -->
    <div v-if="loading" class="flex flex-1 items-center justify-center">
      <div class="flex flex-col items-center gap-3">
        <Loader2 class="size-8 animate-spin text-accent" />
        <span class="text-sm text-muted-foreground">{{ t('error.loading') }}</span>
      </div>
    </div>

    <!-- ── Main Layout ────────────────────────────────────────────────────── -->
    <template v-else>
    <div
      :inert="!isOnline || undefined"
      :class="{ 'opacity-40 pointer-events-none select-none': !isOnline }"
      class="flex flex-1 min-h-0 overflow-hidden"
    >
      <!-- ── Content Area ──────────────────────────────────────────── -->
      <div class="flex flex-1 min-w-0 min-h-0 flex-col overflow-hidden">

        <!-- Channels View -->
        <div
          v-show="mobileTab === 'channels'"
          class="flex flex-col flex-1 min-h-0 overflow-hidden"
        >

          <!-- Channel Table -->
          <div class="flex-1 min-h-0 overflow-hidden">
            <ChannelTable
              :channels="channels"
              :groupedChannels="groupedChannels"
              :dupChannelNrs="dupChannelNrs"
              :channelStatusFn="channelStatus"
              :toggleChannelStatusFn="toggleChannelStatus"
              :onKeydownFn="onKeydown"
              :allShowPhotos="photos"
              :labels="{
                channel: t('field.channel'),
                color: t('field.color'),
                device: t('field.device'),
                quantity: t('field.quantity'),
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
              @clearChannel="clearChannel($event)"
              @reorder="channels.splice(0, channels.length, ...$event)"
              @placeInFloorplan="onPlaceInFloorplan($event)"
              @assignTower="onAssignTower($event)"
              @assignBar="onAssignBar($event)"
            />
          </div>
        </div>

        <!-- Photos View -->
        <div
          v-show="mobileTab === 'photos'"
          class="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          <div class="shrink-0 flex min-h-10 items-center justify-between border-b border-border/90 bg-muted px-4">
            <span class="text-sm font-semibold text-accent">{{ t('show.photos') }}</span>
            <span v-if="photos.length > 0" class="text-xs tabular-nums text-muted-foreground">
              {{ photos.length }}
            </span>
          </div>
          <div class="flex-1 min-h-0 overflow-y-auto p-4">
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
            />
          </div>
        </div>

        <!-- Floorplan View -->
        <div
          v-show="mobileTab === 'floorplan'"
          class="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          <div class="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card shrink-0">
            <span class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {{ t('tab.floorplan') }}
            </span>
          </div>
          <div class="flex-1 min-h-0">
            <FloorplanEditor
              :image-url="floorplan.image_url ? api.url(floorplan.image_url) : null"
              :initial-canvas-data="floorplan.canvas_data"
              :channels="channels"
              :towers="towers"
              :bars="bars"
              :pending-channel="pendingFloorplanChannel"
              @change="onFloorplanChange"
              @snapshot="(snap) => saveShowFloorplanSnapshot(props.id, snap).catch(() => {})"
              @upload-image="onFloorplanImageUpload"
              @delete-image="onFloorplanImageDelete"
              @jump-to-channel="jumpToChannel"
              @open-tower="openTowerFromFloorplan"
              @open-bar="onOpenBarFromFloorplan"
            />
          </div>
        </div>

        <!-- Aufbauplan View -->
        <div
          v-show="mobileTab === 'gassenturm'"
          class="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          <!-- Section-Subtabs -->
          <template v-for="sub in aufbauSubTabs" :key="sub.key">
            <div
              v-if="sub.sectionId"
              v-show="aufbauTab === sub.key"
              class="flex-1 min-h-0 overflow-y-auto"
            >
              <SectionEditor
                :showId="props.id"
                :sectionDefs="sectionDefs"
                :sectionContents="sectionContents"
                :setupMarkdown="setupMarkdown"
                :singleSectionId="sub.sectionId"
                :labels="{
                  titlePlaceholder: t('sections.title.placeholder'),
                  fieldLabel: t('sections.field.label'),
                  fieldValue: t('sections.field.value'),
                  fieldAdd: t('sections.field.add'),
                  addMarkdown: t('sections.add.markdown'),
                  addFields: t('sections.add.fields'),
                }"
                @update:sectionDefs="sectionDefs = $event"
                @update:sectionContents="sectionContents = $event"
                @update:setupMarkdown="onSetupChange($event)"
                @pushSnapshot="pushSnapshot"
                @recordFocus="recordFocus"
                @commitFocus="commitFocus"
                @sectionChange="persistSectionsDebounced"
              />
            </div>
          </template>

          <div v-show="aufbauTab === 'gassenturm'" class="flex-1 min-h-0 overflow-hidden">
            <GassenturmView
              :towers="towers"
              :channels="channels"
              :preselectedChannelId="aufbauTab === 'gassenturm' ? activeChannelForAssign?.id : null"
              :generatedEntries="gassenturmGenerated"
              :addTowerFn="addTower"
              :saveTowerFn="saveTower"
              :deleteTowerFn="removeTower"
              :assignSlotFn="assignSlot"
              :pushSnapshotFn="pushSnapshot"
              @assigned="activeChannelForAssign = null"
            />
          </div>

          <div v-show="aufbauTab === 'zugstangen'" class="flex-1 min-h-0 overflow-hidden">
            <ZugstangenView
              :bars="bars"
              :channels="channels"
              :preselectedChannelId="aufbauTab === 'zugstangen' ? activeChannelForAssign?.id : null"
              :generatedEntries="hangerei"
              :addBarFn="addBar"
              :saveBarFn="saveBar"
              :deleteBarFn="removeBar"
              :assignFixtureFn="assignFixture"
              :updateFixtureNotesFn="updateFixtureNotes"
              :unassignFixtureFn="unassignFixture"
              :reorderBarsFn="reorderBars"
              @assigned="activeChannelForAssign = null"
            />
          </div>
        </div>

      </div>
    </div>
    </template>

    <!-- ── Overlays ───────────────────────────────────────────────────────── -->
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

    <!-- Neuer Tab Dialog -->
    <Dialog :open="newSectionDialog" @update:open="newSectionDialog = $event">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ t('section.dialog.title') }}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div>
            <Label for="newSectionName">{{ t('field.name') }}</Label>
            <Input
              size="lg"
              id="newSectionName"
              v-model="newSectionName"
              :placeholder="t('section.dialog.name.placeholder')"
              @keydown.enter.prevent="confirmNewSection"
              @keydown.esc.prevent="newSectionDialog = false"
            />
          </div>
          <div>
            <Label>{{ t('section.dialog.type') }}</Label>
            <div class="flex flex-col gap-2">
              <button
                :class="['flex items-center gap-4 rounded-xl border p-4 text-left transition-colors', newSectionType === 'markdown' ? 'border-white/20 bg-white/6' : 'border-white/8 hover:border-white/12 hover:bg-white/3']"
                @click="newSectionType = 'markdown'"
              >
                <div :class="['size-4 shrink-0 rounded-full border-2 transition-colors', newSectionType === 'markdown' ? 'border-white bg-white' : 'border-white/30']" />
                <div>
                  <div class="text-sm font-semibold text-foreground">{{ t('section.type.markdown.title') }}</div>
                  <div class="text-xs text-muted-foreground mt-1">{{ t('section.type.markdown.desc') }}</div>
                </div>
              </button>
              <button
                :class="['flex items-center gap-4 rounded-xl border p-4 text-left transition-colors', newSectionType === 'kv-table' ? 'border-white/20 bg-white/6' : 'border-white/8 hover:border-white/12 hover:bg-white/3']"
                @click="newSectionType = 'kv-table'"
              >
                <div :class="['size-4 shrink-0 rounded-full border-2 transition-colors', newSectionType === 'kv-table' ? 'border-white bg-white' : 'border-white/30']" />
                <div>
                  <div class="text-sm font-semibold text-foreground">{{ t('section.type.fields.title') }}</div>
                  <div class="text-xs text-muted-foreground mt-1">{{ t('section.type.fields.desc') }}</div>
                </div>
              </button>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" @click="newSectionDialog = false">{{ t('action.cancel') }}</Button>
          <Button :disabled="!newSectionName.trim()" @click="confirmNewSection">{{ t('action.create') }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

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
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount, defineAsyncComponent } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
import { useLocale } from '../composables/useLocale.js'
import { useConfirm } from '../composables/useConfirm.js'
import { useKeyboardNav } from '../composables/useKeyboardNav.js'

import { useShowPhotos } from '../composables/useShowPhotos.js'
import { useShowSections } from '../composables/useShowSections.js'
import { useShowPresence } from '../composables/useShowPresence.js'
import { useShowChannels } from '../composables/useShowChannels.js'
import { useShowFloorplan } from '../composables/useShowFloorplan.js'
import { saveShowFloorplanSnapshot } from '../api/floorplan.js'
import { useShowTowers } from '../composables/useShowTowers.js'
import { restoreTowersSnapshot } from '../api/towers.js'
import { useShowBars } from '../composables/useShowBars.js'
import { useMeasureUnit } from '../composables/useMeasureUnit'

import ShowHeader from '../components/show/ShowHeader.vue'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { fetchShow, updateMeta, restoreHistory, createSnapshot } from '../api/shows.js'
import { saveShowSectionDefs } from '../api/sections.ts'
import { uuid } from '../utils/uuid.js'
import { downloadChannelsCsv } from '../api/channels.js'
import { generateHangereiEntries, generateGassenturmEntries } from '../utils/generateHangerei'
import PhotoGallery from '../components/show/PhotoGallery.vue'
const HistorySlideOver = defineAsyncComponent(() => import('../components/show/HistorySlideOver.vue'))
import { isOnline } from '../api/client.js'
import { api } from '../api/client.js'

import ChannelTable from '../components/channel/ChannelTable.vue'
const SectionEditor = defineAsyncComponent(() => import('../components/show/SectionEditor.vue'))
const EosMergePreviewDialog = defineAsyncComponent(() => import('../components/EosMergePreviewDialog.vue'))
const FloorplanEditor = defineAsyncComponent(() => import('../components/FloorplanEditor.vue'))
const GassenturmView = defineAsyncComponent(() => import('../components/show/GassenturmView.vue'))
const ZugstangenView = defineAsyncComponent(() => import('../components/show/ZugstangenView.vue'))

const props = defineProps({ id: { type: String, required: true } })
const { t, locale } = useLocale()
const { confirm } = useConfirm()
const { onKeydown } = useKeyboardNav()

// ── Globals ────────────────────────────────────────────────────────────────
const loading = ref(true)
const meta = ref({})

const showDateFormatted = computed(() => {
  if (!meta.value.datum) return ''
  const d = new Date(meta.value.datum)
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
})
const setupMarkdown = ref('')
const setupSaving = ref(false)
const historyOpen = ref(false)

const TAB_KEY = `show-tab-${props.id}`
const SUBTAB_KEY = `show-subtab-${props.id}`
const TAB_TIME_KEY = `show-tab-time-${props.id}`
const TAB_TIMEOUT_MS = 2 * 60 * 60 * 1000 // 2 Stunden

const isTimedOut = Date.now() - Number(localStorage.getItem(TAB_TIME_KEY) || 0) > TAB_TIMEOUT_MS

const mobileTab = ref(isTimedOut ? 'gassenturm' : (sessionStorage.getItem(TAB_KEY) || 'gassenturm'))
if (!localStorage.getItem(TAB_TIME_KEY)) localStorage.setItem(TAB_TIME_KEY, String(Date.now()))
watch(mobileTab, (tab) => {
  sessionStorage.setItem(TAB_KEY, tab)
  localStorage.setItem(TAB_TIME_KEY, String(Date.now()))
  if (tab === 'floorplan') aufbauTab.value = aufbauSubTabs.value[0]?.key ?? null
  if (tab !== 'channels') { search.value = ''; activateHealthFilter(null) }
})

const aufbauTab = ref(isTimedOut ? null : (sessionStorage.getItem(SUBTAB_KEY) || null))
watch(aufbauTab, (tab) => {
  if (tab) sessionStorage.setItem(SUBTAB_KEY, tab)
})

// ── Composables ────────────────────────────────────────────────────────────
const { photos, loadPhotos } = useShowPhotos(props.id)
const { floorplan, loadFloorplan, onFloorplanChange, onFloorplanImageUpload, onFloorplanImageDelete } = useShowFloorplan(props.id)

const {
  sectionDefs, sectionContents, sectionsSaving,
  persistSectionsDebounced, persistSections, persistSectionDefs,
  loadSections, handleSectionsSse
} = useShowSections(props.id, meta)

const AUFBAU_FIXED_TABS = [
  { key: 'gassenturm', label: 'Gassentürme' },
  { key: 'zugstangen', label: 'Zugstangen' },
]
const aufbauSubTabs = computed(() => {
  const sectionTabs = [...sectionDefs.value]
    .sort((a, b) => a.order - b.order)
    .map(s => ({ key: `section:${s.id}`, label: s.title || '(kein Titel)', sectionId: s.id }))
  return [...sectionTabs, ...AUFBAU_FIXED_TABS]
})

watch(aufbauSubTabs, (tabs) => {
  if (!tabs.find(t => t.key === aufbauTab.value)) {
    aufbauTab.value = tabs[0]?.key ?? null
  }
})

let pendingSetupMd = null
const persistSetupDebounced = useDebounceFn(async () => {
  setupSaving.value = true
  try {
    await updateMeta(props.id, { ...meta.value, setupMarkdown: pendingSetupMd })
  } finally {
    setupSaving.value = false
  }
}, 50)

const towers = ref([])

const {
  channels, channelsSaving, search, healthFilter, activateHealthFilter, eosActiveChannels, eosMergePreview,
  dupWarning, dupChannelWarning, dupChannelNrs, groupedChannels,
  scheduleChannelsSave, persistChannels, deleteChannel, clearChannel,
  onCsvImportSelected, onEosFileSelected, resolveEosMergePreview,
  channelStatus, toggleChannelStatus,
  initSnapshot, recordFocus, commitFocus, pushSnapshot,
  undo, redo, canUndo, canRedo, onUndoRedoKeydown,
  loadChannels, handleChannelsSse
} = useShowChannels({
  showId: props.id,
  meta,
  setupMarkdown,
  sectionContents,
  sectionDefs,
  persistSetupDebounced,
  persistSectionsDebounced,
  persistSections,
  persistSectionDefs,
  towers,
  saveTowersSnapshot: (snapshot) => restoreTowersSnapshot(props.id, snapshot),
  t,
  confirm
})

const { loadTowers, addTower, saveTower, removeTower, assignSlot } = useShowTowers(props.id, channels, towers)
const { bars, loadBars, addBar, saveBar, removeBar, assignFixture, updateFixtureNotes, unassignFixture, reorderBars } = useShowBars(props.id, channels)

const { unit, cmToDisplay } = useMeasureUnit()
const channelByIdForHangerei = computed(() => new Map(channels.value.map(c => [c.id, c])))
const hangerei = computed(() => generateHangereiEntries(bars.value, channelByIdForHangerei.value, unit.value, cmToDisplay, locale.value))
const gassenturmGenerated = computed(() => generateGassenturmEntries(towers.value, channelByIdForHangerei.value, locale.value))

const { presence, initPresence, cleanupPresence } = useShowPresence(props.id, {
  onChannels: handleChannelsSse,
  onSections: handleSectionsSse,
  onTowers: () => loadTowers(),
  onBars: () => loadBars(),
})

// ── Health Stats ───────────────────────────────────────────────────────────
const healthStats = computed(() => {
  const chs = channels.value
  return {
    noNotes:    chs.filter(c => !(c.notes ?? '').trim()).length,
    noDevice:   chs.filter(c => !(c.device ?? '').trim()).length,
    noPosition: chs.filter(c => !(c.position ?? '').trim()).length,
    noAddress:  chs.filter(c => !(c.address ?? '').trim()).length,
  }
})

const healthLabels = computed(() => ({
  title:      t('health.title'),
  complete:   t('health.complete'),
  noNotes:    t('health.noNotes'),
  noDevice:   t('health.noDevice'),
  noPosition: t('health.noPosition'),
  noAddress:  t('health.noAddress'),
}))

function onHealthFilter(type) {
  if (!type) { activateHealthFilter(null); return }
  mobileTab.value = 'channels'
  search.value = ''
  activateHealthFilter(healthFilter.value === type ? null : type)
}

// ── Editor ─────────────────────────────────────────────────────────────────
function onSetupChange(md) {
  recordFocus()
  pendingSetupMd = md
  setupSaving.value = true
  persistSetupDebounced()
  nextTick(() => commitFocus())
}

// ── History ─────────────────────────────────────────────────────────────────
async function onRenameShow(name) {
  meta.value.name = name
  await updateMeta(props.id, { ...meta.value })
}

function openHistory() {
  historyOpen.value = true
}

async function doRestoreHistory(entry) {
  pushSnapshot()
  await restoreHistory(props.id, entry.id)
  await Promise.all([loadChannels(), loadSections()])
  historyOpen.value = false
}

// ── PDF ────────────────────────────────────────────────────────────────────
async function openPdf() {
  const url = await api.downloadUrl(`/api/shows/${props.id}/pdf`)
  window.open(url, '_blank')
}

function jumpToChannel(channelNum) {
  mobileTab.value = 'channels'
  nextTick(() => {
    const el = document.querySelector(`[data-ch-key="${channelNum}|"]`) ??
                document.querySelector(`[data-ch-key^="${channelNum}|"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (el) {
      el.classList.add('ring-2', 'ring-accent', 'ring-inset')
      setTimeout(() => el.classList.remove('ring-2', 'ring-accent', 'ring-inset'), 1500)
    }
  })
}

function openTowerFromFloorplan(_towerId) {
  mobileTab.value = 'gassenturm'
  aufbauTab.value = 'gassenturm'
}

function onOpenBarFromFloorplan(_barId) {
  mobileTab.value = 'gassenturm'
  aufbauTab.value = 'zugstangen'
}

const activeChannelForAssign = ref(null)
const pendingFloorplanChannel = ref(null)

async function onAssignTower(ch) {
  if (!ch.id) await persistChannels()
  activeChannelForAssign.value = channels.value.find(c => c.channel === ch.channel) ?? ch
  mobileTab.value = 'gassenturm'
  aufbauTab.value = 'gassenturm'
}

async function onAssignBar(ch) {
  if (!ch.id) await persistChannels()
  activeChannelForAssign.value = channels.value.find(c => c.channel === ch.channel) ?? ch
  mobileTab.value = 'gassenturm'
  aufbauTab.value = 'zugstangen'
}

function onPlaceInFloorplan(ch) {
  pendingFloorplanChannel.value = null
  nextTick(() => {
    pendingFloorplanChannel.value = channels.value.find(c => c.channel === ch.channel) ?? ch
    mobileTab.value = 'floorplan'
  })
}

const newSectionDialog = ref(false)
const newSectionName = ref('')
const newSectionType = ref('markdown')

function addSectionFromSubtab() {
  newSectionName.value = ''
  newSectionType.value = 'markdown'
  newSectionDialog.value = true
}

async function confirmNewSection() {
  const title = newSectionName.value.trim()
  if (!title) return
  newSectionDialog.value = false
  pushSnapshot()
  const id = uuid()
  const newDefs = [...sectionDefs.value, { id, title, type: newSectionType.value, order: sectionDefs.value.length, rows: newSectionType.value === 'kv-table' ? [] : undefined }]
  sectionDefs.value = newDefs
  await saveShowSectionDefs(props.id, newDefs)
  aufbauTab.value = `section:${id}`
}

// ── Laden ──────────────────────────────────────────────────────────────────
let snapshotInterval = null

onMounted(async () => {
  try {
    const [showData] = await Promise.all([
      fetchShow(props.id),
      loadChannels(),
      loadPhotos(),
      loadSections()
    ])

    meta.value = { name: showData.name, datum: showData.datum, template: showData.template, untertitel: showData.untertitel, spielzeit: showData.spielzeit }
    setupMarkdown.value = showData.setupMarkdown ?? ''
    eosActiveChannels.value = showData.eosActiveChannels ?? null

  } catch (e) {
    console.error('Ladefehler:', e)
  } finally {
    loading.value = false
  }

  initSnapshot()
  createSnapshot(props.id).catch(() => {})
  snapshotInterval = setInterval(() => createSnapshot(props.id).catch(() => {}), 10 * 60 * 1000)

  loadFloorplan().catch(() => {})
  loadTowers().catch(() => {})
  loadBars().catch(() => {})
  initPresence()

  await nextTick()
  window.addEventListener('keydown', onUndoRedoKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onUndoRedoKeydown)
  cleanupPresence()
  clearInterval(snapshotInterval)
  persistSetupDebounced?.flush?.()
  persistChannels?.flush?.()
  persistSectionsDebounced?.flush?.()
})
</script>
