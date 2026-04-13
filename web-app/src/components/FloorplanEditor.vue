<template>
  <div class="relative flex h-full overflow-hidden bg-gray-950 text-white">
    <!-- Left Toolbar -->
    <div class="w-[52px] bg-gray-900 border-r border-white/10 flex flex-col items-center py-2 gap-1">
      <button @click="activeTool = 'select'"
        :class="['p-2 rounded hover:bg-gray-800', activeTool === 'select' ? 'bg-amber-500' : 'bg-gray-800']"
        title="Select (↖)">↖</button>

      <button @click="activeTool = 'line'"
        :class="['p-2 rounded hover:bg-gray-800', activeTool === 'line' ? 'bg-amber-500' : 'bg-gray-800']"
        title="Line (╱)">╱</button>

      <button @click="activeTool = 'rect'"
        :class="['p-2 rounded hover:bg-gray-800', activeTool === 'rect' ? 'bg-amber-500' : 'bg-gray-800']"
        title="Rectangle (▭)">▭</button>

      <button @click="activeTool = 'text'"
        :class="['p-2 rounded hover:bg-gray-800', activeTool === 'text' ? 'bg-amber-500' : 'bg-gray-800']"
        title="Text (T)">T</button>

      <button @click="activeTool = 'channel'"
        :class="['p-2 rounded hover:bg-gray-800', activeTool === 'channel' ? 'bg-amber-500' : 'bg-gray-800']"
        title="Channel (①)">①</button>

      <button @click="imageUploadInput?.click()"
        class="p-2 rounded hover:bg-gray-800 bg-gray-800"
        title="Bild hochladen">↑</button>
      <input ref="imageUploadInput" type="file" accept="image/*" class="hidden" @change="onImageFileSelected" />

      <button @click="exportPNG"
        class="p-2 rounded hover:bg-gray-800 bg-gray-800 text-xs font-bold"
        title="Als PNG exportieren">PNG</button>

      <button @click="exportPDF"
        class="p-2 rounded hover:bg-gray-800 bg-gray-800 text-xs font-bold"
        title="Als PDF exportieren">PDF</button>

      <div class="flex-1"></div>

      <button title="Rückgängig (Ctrl+Z)"
        :disabled="historyIndex <= 0"
        :class="['w-8 h-8 rounded flex items-center justify-center text-xs border transition-colors',
          historyIndex > 0 ? 'text-gray-300 border-white/10 hover:bg-white/10' : 'text-gray-700 border-white/5 cursor-not-allowed']"
        @click="undo">↩</button>

      <button title="Wiederholen (Ctrl+Y)"
        :disabled="historyIndex >= history.length - 1"
        :class="['w-8 h-8 rounded flex items-center justify-center text-xs border transition-colors',
          historyIndex < history.length - 1 ? 'text-gray-300 border-white/10 hover:bg-white/10' : 'text-gray-700 border-white/5 cursor-not-allowed']"
        @click="redo">↪</button>

      <button @click="deleteSelected"
        :disabled="selectedIds.size === 0"
        :class="['p-2 rounded hover:bg-gray-800', selectedIds.size > 0 ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 text-gray-500 cursor-not-allowed']"
        title="Delete (Delete/Backspace)">✕</button>
    </div>

    <!-- Center Canvas -->
    <div ref="containerEl" class="flex-1 relative bg-gray-950 overflow-hidden flex items-center justify-center">
      <v-stage
        ref="stageRef"
        :config="stageConfig"
        @mousedown="onStageMouseDown"
        @mousemove="onStageMouseMove"
        @mouseup="onStageMouseUp"
      >
        <!-- Background image layer -->
        <v-layer>
          <v-image v-if="bgImage" :config="{ image: bgImage, width: 1920, height: 1080, listening: false }" />
        </v-layer>

        <!-- Elements layer -->
        <v-layer ref="elementsLayerRef">
          <!-- Lines -->
          <v-line
            v-for="el in lines"
            :key="el.id"
            :config="{
              points: [el.x1, el.y1, el.x2, el.y2],
              stroke: selectedIds.has(el.id) ? '#f59e0b' : '#6b7280',
              strokeWidth: selectedIds.has(el.id) ? 3 : 2,
              rotation: el.rotation || 0,
              offsetX: (el.x1 + el.x2) / 2,
              offsetY: (el.y1 + el.y2) / 2,
              x: (el.x1 + el.x2) / 2,
              y: (el.y1 + el.y2) / 2,
              draggable: activeTool === 'select',
              hitStrokeWidth: 10,
            }"
            @click="onNodeClick(el.id, $event)"
            @dragstart="onLineDragStart(el, $event)"
            @dragend="onLineDragEnd(el, $event)"
          />

          <!-- Rectangles -->
          <v-rect
            v-for="el in rects"
            :key="el.id"
            :config="{
              x: el.x,
              y: el.y,
              width: el.w,
              height: el.h,
              stroke: selectedIds.has(el.id) ? '#f59e0b' : '#6b7280',
              strokeWidth: selectedIds.has(el.id) ? 3 : 2,
              fill: 'transparent',
              rotation: el.rotation || 0,
              offsetX: el.w / 2,
              offsetY: el.h / 2,
              x: el.x + el.w / 2,
              y: el.y + el.h / 2,
              draggable: activeTool === 'select',
            }"
            @click="onNodeClick(el.id, $event)"
            @dragend="onRectDragEnd(el, $event)"
          />

          <!-- Text elements -->
          <v-text
            v-for="el in texts"
            :key="el.id"
            :config="{
              x: el.x,
              y: el.y,
              text: el.text,
              fill: selectedIds.has(el.id) ? '#f59e0b' : '#9ca3af',
              fontSize: 14,
              rotation: el.rotation || 0,
              draggable: activeTool === 'select',
            }"
            @click="onNodeClick(el.id, $event)"
            @dragend="onSimpleDragEnd(el, $event)"
          />

          <!-- Channel markers -->
          <v-group
            v-for="el in channels"
            :key="el.id"
            :config="{
              x: el.x,
              y: el.y,
              draggable: activeTool === 'select',
            }"
            @click="onNodeClick(el.id, $event)"
            @dragend="onSimpleDragEnd(el, $event)"
          >
            <v-circle :config="{
              radius: 14,
              stroke: selectedIds.has(el.id) ? '#f59e0b' : '#2563eb',
              strokeWidth: selectedIds.has(el.id) ? 2.5 : 2,
              fill: '#1e3a5f',
            }" />
            <v-text :config="{
              text: el.channel,
              fontSize: 10,
              fontStyle: 'bold',
              fill: selectedIds.has(el.id) ? '#f59e0b' : '#60a5fa',
              align: 'center',
              verticalAlign: 'middle',
              width: 28,
              height: 28,
              offsetX: 14,
              offsetY: 14,
              listening: false,
            }" />
          </v-group>

          <!-- Preview shape during draw -->
          <v-line
            v-if="preview && activeTool === 'line'"
            :config="{
              points: [preview.x1, preview.y1, preview.x2, preview.y2],
              stroke: '#3b82f6',
              strokeWidth: 2,
              dash: [4, 4],
              listening: false,
            }"
          />
          <v-rect
            v-if="preview && activeTool === 'rect'"
            :config="{
              x: preview.x,
              y: preview.y,
              width: preview.w,
              height: preview.h,
              stroke: '#3b82f6',
              strokeWidth: 2,
              dash: [4, 4],
              fill: 'transparent',
              listening: false,
            }"
          />

          <!-- Lasso selection rect -->
          <v-rect
            v-if="lassoRect"
            :config="{
              x: lassoRect.x,
              y: lassoRect.y,
              width: lassoRect.w,
              height: lassoRect.h,
              fill: 'rgba(59,130,246,0.1)',
              stroke: '#3b82f6',
              strokeWidth: 1,
              dash: [4, 4],
              listening: false,
            }"
          />
        </v-layer>
      </v-stage>
    </div>

    <!-- Right Properties Panel -->
    <div
      v-if="selectedIds.size === 1"
      class="absolute top-2 right-2 w-[180px] bg-gray-900/95 border border-white/10 rounded-lg overflow-y-auto p-4 flex flex-col gap-4 z-20 shadow-xl"
    >
      <div v-if="selectedElement && selectedElement.type === 'channel'">
        <h3 class="text-sm font-semibold text-amber-500 mb-2">Kanal</h3>
        <div class="text-xs space-y-1 text-gray-400 mb-3">
          <div v-if="channelInfo">
            <div>{{ channelInfo.device }}</div>
            <div>{{ channelInfo.position }}</div>
            <div>{{ channelInfo.address }}</div>
            <div v-if="channelInfo.color" class="flex items-center gap-2 mt-1">
              <div :style="{ backgroundColor: channelInfo.color }" class="w-4 h-4 border border-gray-600"></div>
              {{ channelInfo.color }}
            </div>
          </div>
        </div>
        <button @click="jumpToChannel" class="w-full px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded text-white">
          → Zum Kanal
        </button>
      </div>

      <div v-else-if="selectedElement && selectedElement.type === 'text'">
        <h3 class="text-sm font-semibold text-amber-500 mb-2">Text</h3>
        <input
          v-model="selectedElement.text"
          type="text"
          class="w-full px-2 py-1 bg-gray-800 border border-gray-700 text-white text-sm rounded"
          @input="emitChange"
        />
      </div>

      <div v-else-if="selectedElement && (selectedElement.type === 'line' || selectedElement.type === 'rect')">
        <p class="text-xs text-gray-400">
          {{ selectedElement.type === 'line' ? 'Linie ausgewählt' : 'Rechteck ausgewählt' }}
        </p>
      </div>

      <template v-if="selectedElement && selectedElement.type !== 'channel'">
        <div class="mb-2 mt-3">
          <div class="text-gray-500 uppercase tracking-wide mb-0.5 text-xs">Rotation</div>
          <input type="range" min="-180" max="180" step="1"
            :value="selectedElement.rotation || 0"
            @input="updateRotation(selectedElement.id, +$event.target.value)"
            class="w-full accent-blue-500"
          />
          <div class="text-gray-400 text-right text-xs">{{ selectedElement.rotation || 0 }}°</div>
        </div>
      </template>
    </div>

    <!-- Channel Picker Modal -->
    <div
      v-if="showChannelPicker"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-30"
      @click="showChannelPicker = false"
    >
      <div class="bg-gray-800 rounded-lg p-4 w-64 max-h-96 flex flex-col" @click.stop>
        <h3 class="text-sm font-semibold mb-3">Kanal wählen</h3>
        <input
          v-model="channelSearch"
          type="text"
          placeholder="Suchen..."
          class="w-full px-2 py-1 bg-gray-700 border border-gray-600 text-white text-sm rounded mb-3 focus:outline-none focus:border-amber-500"
          autofocus
        />
        <div class="flex-1 overflow-y-auto space-y-1">
          <button
            v-for="ch in filteredChannels"
            :key="ch.channel"
            :disabled="usedChannels.includes(ch.channel)"
            @click="placeChannelCircle(ch)"
            :class="[
              'w-full text-left px-2 py-1 text-sm rounded hover:bg-gray-700',
              usedChannels.includes(ch.channel)
                ? 'bg-gray-900 text-gray-500 cursor-not-allowed'
                : 'text-white'
            ]"
          >
            <div class="font-semibold">{{ ch.channel }}</div>
            <div class="text-xs text-gray-400">{{ ch.device }}</div>
          </button>
        </div>
        <button @click="showChannelPicker = false" class="mt-3 w-full px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded">
          Abbrechen
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { uuid } from '../utils/uuid.js'
import jsPDF from 'jspdf'

const props = defineProps({
  imageUrl: { type: String, default: null },
  initialCanvasData: { type: String, default: null },
  channels: { type: Array, default: () => [] }
})

const emit = defineEmits(['change', 'jump-to-channel', 'upload-image'])

// State
const activeTool = ref('select')
const elements = ref([])
const selectedIds = ref(new Set())
const preview = ref(null)
const drawStart = ref(null)
const showChannelPicker = ref(false)
const channelPickerPos = ref({ x: 0, y: 0 })
const channelSearch = ref('')
const stageRef = ref(null)
const elementsLayerRef = ref(null)
const containerEl = ref(null)
const imageUploadInput = ref(null)
const history = ref([])
const historyIndex = ref(-1)
const lassoRect = ref(null)
const bgImage = ref(null)
const stageSize = ref({ width: 1920, height: 1080 })

// Computed element groups
const lines = computed(() => elements.value.filter(e => e.type === 'line'))
const rects = computed(() => elements.value.filter(e => e.type === 'rect'))
const texts = computed(() => elements.value.filter(e => e.type === 'text'))
const channels = computed(() => elements.value.filter(e => e.type === 'channel'))

// Stage config with responsive scaling
const stageConfig = computed(() => {
  const scale = Math.min(stageSize.value.width / 1920, stageSize.value.height / 1080)
  const w = 1920 * scale
  const h = 1080 * scale
  return { width: w, height: h, scaleX: scale, scaleY: scale }
})

// Computed
const selectedId = computed(() => selectedIds.value.size === 1 ? [...selectedIds.value][0] : null)
const selectedElement = computed(() => elements.value.find(e => e.id === selectedId.value))
const usedChannels = computed(() => elements.value.filter(e => e.type === 'channel').map(e => e.channel))
const channelInfo = computed(() => {
  if (!selectedElement.value || selectedElement.value.type !== 'channel') return null
  return props.channels.find(ch => ch.channel === selectedElement.value.channel)
})
const filteredChannels = computed(() => {
  const query = channelSearch.value.toLowerCase()
  return props.channels.filter(ch =>
    ch.channel.toLowerCase().includes(query) ||
    (ch.device && ch.device.toLowerCase().includes(query))
  )
})

// Background image loader
watch(() => props.imageUrl, (url) => {
  if (!url) { bgImage.value = null; return }
  const img = new Image()
  img.onload = () => { bgImage.value = img }
  img.src = url
}, { immediate: true })

// Get pointer position in logical (1920x1080) coordinates
function getPointerPos() {
  const stage = stageRef.value?.getNode()
  if (!stage) return { x: 0, y: 0 }
  const pos = stage.getPointerPosition()
  if (!pos) return { x: 0, y: 0 }
  const scale = stageConfig.value.scaleX
  return { x: pos.x / scale, y: pos.y / scale }
}

// Click on a node
function onNodeClick(id, e) {
  if (activeTool.value !== 'select') return
  e.cancelBubble = true
  if (e.evt.shiftKey) {
    const s = new Set(selectedIds.value)
    s.has(id) ? s.delete(id) : s.add(id)
    selectedIds.value = s
  } else {
    selectedIds.value = new Set([id])
  }
}

// Drag handlers for lines (special: need to update x1/y1/x2/y2)
function onLineDragStart(el, e) {
  e.cancelBubble = true
}

function onLineDragEnd(el, e) {
  e.cancelBubble = true
  const node = e.target
  const dx = node.x()
  const dy = node.y()
  el.x1 += dx; el.y1 += dy; el.x2 += dx; el.y2 += dy
  node.position({ x: 0, y: 0 })
  emitChange()
}

// Drag handlers for rect (center-anchored)
function onRectDragEnd(el, e) {
  e.cancelBubble = true
  const node = e.target
  // node x/y is the center point
  el.x = node.x() - el.w / 2
  el.y = node.y() - el.h / 2
  node.position({ x: el.x + el.w / 2, y: el.y + el.h / 2 })
  emitChange()
}

// Drag handlers for text and channel (x/y = position)
function onSimpleDragEnd(el, e) {
  e.cancelBubble = true
  const node = e.target
  el.x = node.x()
  el.y = node.y()
  emitChange()
}

// Stage mouse handlers for drawing
function onStageMouseDown(e) {
  // Only act on direct stage/layer clicks, not node clicks
  const stage = stageRef.value?.getNode()
  if (!stage) return
  const clickedOnStage = e.target === stage || e.target.getType() === 'Layer'
  if (!clickedOnStage && activeTool.value !== 'select') return

  const pos = getPointerPos()

  if (activeTool.value === 'select') {
    if (clickedOnStage && !e.evt.shiftKey) selectedIds.value = new Set()
    drawStart.value = pos
    lassoRect.value = null
  } else if (activeTool.value === 'line' || activeTool.value === 'rect') {
    drawStart.value = pos
    preview.value = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y, x: pos.x, y: pos.y, w: 0, h: 0 }
  } else if (activeTool.value === 'channel' || activeTool.value === 'text') {
    drawStart.value = pos
  }
}

function onStageMouseMove(e) {
  if (!drawStart.value) return
  const pos = getPointerPos()

  if (activeTool.value === 'select' && drawStart.value) {
    lassoRect.value = {
      x: Math.min(pos.x, drawStart.value.x),
      y: Math.min(pos.y, drawStart.value.y),
      w: Math.abs(pos.x - drawStart.value.x),
      h: Math.abs(pos.y - drawStart.value.y),
    }
  } else if (activeTool.value === 'line' && preview.value) {
    preview.value = { ...preview.value, x2: pos.x, y2: pos.y }
  } else if (activeTool.value === 'rect' && preview.value) {
    preview.value = {
      x: Math.min(drawStart.value.x, pos.x),
      y: Math.min(drawStart.value.y, pos.y),
      w: Math.abs(pos.x - drawStart.value.x),
      h: Math.abs(pos.y - drawStart.value.y),
    }
  }
}

function onStageMouseUp(e) {
  if (!drawStart.value) return
  const pos = getPointerPos()
  const dx = pos.x - drawStart.value.x
  const dy = pos.y - drawStart.value.y
  const distance = Math.sqrt(dx * dx + dy * dy)

  if (activeTool.value === 'select' && lassoRect.value) {
    const { x, y, w, h } = lassoRect.value
    const inLasso = elements.value.filter(el => {
      let cx, cy
      if (el.type === 'line') { cx = (el.x1 + el.x2) / 2; cy = (el.y1 + el.y2) / 2 }
      else if (el.type === 'rect') { cx = el.x + el.w / 2; cy = el.y + el.h / 2 }
      else { cx = el.x; cy = el.y }
      return cx >= x && cx <= x + w && cy >= y && cy <= y + h
    })
    selectedIds.value = new Set(inLasso.map(e => e.id))
    lassoRect.value = null
    drawStart.value = null
    return
  }

  if (distance > 5) {
    if (activeTool.value === 'line') {
      addElement({ id: uuid(), type: 'line', x1: drawStart.value.x, y1: drawStart.value.y, x2: pos.x, y2: pos.y, rotation: 0 })
      emitChange()
    } else if (activeTool.value === 'rect') {
      addElement({
        id: uuid(), type: 'rect',
        x: Math.min(drawStart.value.x, pos.x),
        y: Math.min(drawStart.value.y, pos.y),
        w: Math.abs(pos.x - drawStart.value.x),
        h: Math.abs(pos.y - drawStart.value.y),
        rotation: 0
      })
      emitChange()
    }
  } else {
    if (activeTool.value === 'channel') {
      channelPickerPos.value = drawStart.value
      channelSearch.value = ''
      showChannelPicker.value = true
    } else if (activeTool.value === 'text') {
      addElement({ id: uuid(), type: 'text', x: drawStart.value.x, y: drawStart.value.y, text: 'Text', rotation: 0 })
      emitChange()
    } else if (activeTool.value === 'select') {
      selectedIds.value = new Set()
    }
  }

  drawStart.value = null
  preview.value = null
  lassoRect.value = null
}

function addElement(el) {
  elements.value.push(el)
}

function deleteSelected() {
  if (selectedIds.value.size === 0) return
  elements.value = elements.value.filter(e => !selectedIds.value.has(e.id))
  selectedIds.value = new Set()
  emitChange()
}

function placeChannelCircle(ch) {
  addElement({ id: uuid(), type: 'channel', x: channelPickerPos.value.x, y: channelPickerPos.value.y, channel: ch.channel })
  showChannelPicker.value = false
  emitChange()
}

function onImageFileSelected(e) {
  const file = e.target.files?.[0]
  if (file) emit('upload-image', file)
  e.target.value = ''
}

function jumpToChannel() {
  if (selectedElement.value?.type === 'channel') {
    emit('jump-to-channel', selectedElement.value.channel)
  }
}

function updateRotation(id, deg) {
  const el = elements.value.find(e => e.id === id)
  if (el) { el.rotation = deg; emitChange() }
}

// Export / Import
function exportData() {
  return JSON.stringify(elements.value)
}

function parseData(str) {
  if (!str) return
  try {
    elements.value = JSON.parse(str)
  } catch (err) {
    console.error('Error parsing canvas data:', err)
  }
}

// History
function pushHistory() {
  const snap = exportData()
  let h = history.value.slice(0, historyIndex.value + 1)
  h.push(snap)
  if (h.length > 50) h = h.slice(-50)
  history.value = h
  historyIndex.value = history.value.length - 1
}

function undo() {
  if (historyIndex.value <= 0) return
  historyIndex.value--
  parseData(history.value[historyIndex.value])
  emit('change', history.value[historyIndex.value])
}

function redo() {
  if (historyIndex.value >= history.value.length - 1) return
  historyIndex.value++
  parseData(history.value[historyIndex.value])
  emit('change', history.value[historyIndex.value])
}

function emitChange() {
  pushHistory()
  emit('change', exportData())
}

// PNG Export
function exportPNG() {
  const stage = stageRef.value?.getNode()
  if (!stage) return
  const dataUrl = stage.toDataURL({ pixelRatio: 2 })
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = 'grundriss.png'
  a.click()
}

// PDF Export
function exportPDF() {
  const stage = stageRef.value?.getNode()
  if (!stage) return
  const dataUrl = stage.toDataURL({ pixelRatio: 2 })
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  pdf.addImage(dataUrl, 'PNG', 0, 0, pageW, pageH)
  pdf.save('grundriss.pdf')
}

// Responsive scaling via ResizeObserver
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  if (containerEl.value) {
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (width === 0 || height === 0) return
      stageSize.value = { width, height }
    })
    ro.observe(containerEl.value)
    // Store for cleanup
    containerEl.value._ro = ro
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  containerEl.value?._ro?.disconnect()
})

watch(() => props.initialCanvasData, (newVal) => {
  parseData(newVal)
  history.value = [exportData()]
  historyIndex.value = 0
}, { immediate: true })

function isInputFocused() {
  return document.activeElement?.tagName === 'INPUT'
}

function handleKeyDown(e) {
  if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputFocused()) {
    deleteSelected()
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
}
</script>
