<template>
  <div class="flex flex-col h-dvh bg-background overflow-hidden">

    <!-- ── Top Navigation Bar ─────────────────────────────────────────────── -->
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
        tabPhotos: t('tab.photos'),
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

    <!-- ── Loading ────────────────────────────────────────────────────────── -->
    <div v-if="loading" class="flex flex-1 items-center justify-center">
      <div class="flex flex-col items-center gap-3">
        <Loader2 class="size-8 animate-spin text-accent" />
        <span class="text-sm text-muted-foreground">Wird geladen…</span>
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
              @change="onFloorplanChange"
              @upload-image="onFloorplanImageUpload"
              @delete-image="onFloorplanImageDelete"
              @jump-to-channel="jumpToChannel"
            />
          </div>
        </div>

        <!-- Info View -->
        <div
          v-show="mobileTab === 'info'"
          class="flex-1 min-h-0 overflow-y-auto"
        >
            <SectionEditor
              :showId="props.id"
              :sectionDefs="sectionDefs"
              :sectionContents="sectionContents"
              :setupMarkdown="setupMarkdown"
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
              @sectionChange="persistSectionsDebounced"
            />
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
import { ref, watch, nextTick, onMounted, onBeforeUnmount, defineAsyncComponent } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
import { useRouter } from 'vue-router'
import { useLocale } from '../composables/useLocale.js'
import { useConfirm } from '../composables/useConfirm.js'
import { useKeyboardNav } from '../composables/useKeyboardNav.js'

import { useShowPhotos } from '../composables/useShowPhotos.js'
import { useShowSections } from '../composables/useShowSections.js'
import { useShowPresence } from '../composables/useShowPresence.js'
import { useShowChannels } from '../composables/useShowChannels.js'
import { useShowFloorplan } from '../composables/useShowFloorplan.js'

import ShowHeader from '../components/show/ShowHeader.vue'
import { fetchShow, updateMeta, restoreHistory, createSnapshot } from '../api/shows.js'
import { downloadChannelsCsv } from '../api/channels.js'
import PhotoGallery from '../components/show/PhotoGallery.vue'
const HistorySlideOver = defineAsyncComponent(() => import('../components/show/HistorySlideOver.vue'))
import { isOnline } from '../api/client.js'
import { api } from '../api/client.js'

import ChannelTable from '../components/channel/ChannelTable.vue'
import SectionEditor from '../components/show/SectionEditor.vue'
const EosMergePreviewDialog = defineAsyncComponent(() => import('../components/EosMergePreviewDialog.vue'))
const FloorplanEditor = defineAsyncComponent(() => import('../components/FloorplanEditor.vue'))

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()
const { t } = useLocale()
const { confirm } = useConfirm()
const { onKeydown } = useKeyboardNav()

// ── Globals ────────────────────────────────────────────────────────────────
const loading = ref(true)
const meta = ref({})
const setupMarkdown = ref('')
const setupSaving = ref(false)
const historyOpen = ref(false)

const TAB_KEY = `show-tab-${props.id}`
const mobileTab = ref(sessionStorage.getItem(TAB_KEY) || 'channels')
watch(mobileTab, (tab) => sessionStorage.setItem(TAB_KEY, tab))

// ── Composables ────────────────────────────────────────────────────────────
const { photos, loadPhotos } = useShowPhotos(props.id)
const { floorplan, loadFloorplan, onFloorplanChange, onFloorplanImageUpload, onFloorplanImageDelete } = useShowFloorplan(props.id)

const {
  sectionDefs, sectionContents, sectionsSaving,
  persistSectionsDebounced, persistSections,
  loadSections, handleSectionsSse
} = useShowSections(props.id, meta)

let pendingSetupMd = null
const persistSetupDebounced = useDebounceFn(async () => {
  setupSaving.value = true
  try {
    await updateMeta(props.id, { ...meta.value, setupMarkdown: pendingSetupMd })
    meta.value.datum = new Date().toISOString().split('T')[0]
  } finally {
    setupSaving.value = false
  }
}, 50)

const {
  channels, channelsSaving, search, eosActiveChannels, eosMergePreview,
  dupWarning, dupChannelWarning, dupChannelNrs, groupedChannels,
  scheduleChannelsSave, persistChannels, deleteChannel,
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
  t,
  confirm
})

const { presence, initPresence, cleanupPresence } = useShowPresence(props.id, {
  onChannels: handleChannelsSse,
  onSections: handleSectionsSse
})

// ── Editor ─────────────────────────────────────────────────────────────────
function onSetupChange(md) {
  recordFocus()
  pendingSetupMd = md
  setupSaving.value = true
  persistSetupDebounced()
  nextTick(() => commitFocus())
}

// ── History ─────────────────────────────────────────────────────────────────
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

function jumpToChannel(_channelNum) {
  mobileTab.value = 'channels'
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
