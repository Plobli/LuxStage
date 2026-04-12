<template>
  <div class="flex h-full overflow-hidden bg-gray-950 text-white">
    <!-- Left Toolbar -->
    <div class="w-[52px] bg-gray-900 border-r border-white/10 flex flex-col items-center py-2 gap-1">
      <!-- Select tool -->
      <button
        @click="activeTool = 'select'"
        :class="['p-2 rounded hover:bg-gray-800', activeTool === 'select' ? 'bg-amber-500' : 'bg-gray-800']"
        title="Select (↖)"
      >
        ↖
      </button>

      <!-- Line tool -->
      <button
        @click="activeTool = 'line'"
        :class="['p-2 rounded hover:bg-gray-800', activeTool === 'line' ? 'bg-amber-500' : 'bg-gray-800']"
        title="Line (╱)"
      >
        ╱
      </button>

      <!-- Rect tool -->
      <button
        @click="activeTool = 'rect'"
        :class="['p-2 rounded hover:bg-gray-800', activeTool === 'rect' ? 'bg-amber-500' : 'bg-gray-800']"
        title="Rectangle (▭)"
      >
        ▭
      </button>

      <!-- Text tool -->
      <button
        @click="activeTool = 'text'"
        :class="['p-2 rounded hover:bg-gray-800', activeTool === 'text' ? 'bg-amber-500' : 'bg-gray-800']"
        title="Text (T)"
      >
        T
      </button>

      <!-- Channel tool -->
      <button
        @click="activeTool = 'channel'"
        :class="['p-2 rounded hover:bg-gray-800', activeTool === 'channel' ? 'bg-amber-500' : 'bg-gray-800']"
        title="Channel (①)"
      >
        ①
      </button>

      <!-- Upload image -->
      <button
        @click="imageUploadInput?.click()"
        :class="['p-2 rounded hover:bg-gray-800 bg-gray-800']"
        title="Bild hochladen"
      >
        ↑
      </button>
      <input
        ref="imageUploadInput"
        type="file"
        accept="image/*"
        class="hidden"
        @change="onImageFileSelected"
      />

      <!-- Spacer -->
      <div class="flex-1"></div>

      <!-- Undo button -->
      <button title="Rückgängig (Ctrl+Z)"
        :disabled="historyIndex <= 0"
        :class="['w-8 h-8 rounded flex items-center justify-center text-xs border transition-colors',
          historyIndex > 0 ? 'text-gray-300 border-white/10 hover:bg-white/10' : 'text-gray-700 border-white/5 cursor-not-allowed']"
        @click="undo"
      >↩</button>

      <!-- Redo button -->
      <button title="Wiederholen (Ctrl+Y)"
        :disabled="historyIndex >= history.length - 1"
        :class="['w-8 h-8 rounded flex items-center justify-center text-xs border transition-colors',
          historyIndex < history.length - 1 ? 'text-gray-300 border-white/10 hover:bg-white/10' : 'text-gray-700 border-white/5 cursor-not-allowed']"
        @click="redo"
      >↪</button>

      <!-- Delete button -->
      <button
        @click="deleteSelected"
        :disabled="selectedIds.size === 0"
        :class="['p-2 rounded hover:bg-gray-800', selectedIds.size > 0 ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 text-gray-500 cursor-not-allowed']"
        title="Delete (Delete/Backspace)"
      >
        ✕
      </button>
    </div>

    <!-- Center Canvas -->
    <div
      ref="canvasEl"
      class="flex-1 relative bg-gray-950 overflow-hidden flex items-center justify-center"
      @mousedown="onCanvasMouseDown"
      @mousemove="onCanvasMouseMove"
      @mouseup="onCanvasMouseUp"
    >
      <!-- Background image -->
      <img
        v-if="imageUrl"
        :src="imageUrl"
        class="absolute inset-0 object-contain"
        style="pointer-events: none;"
        alt="Floor plan"
      />

      <!-- SVG overlay -->
      <svg
        ref="svgEl"
        :viewBox="`0 0 ${svgWidth} ${svgHeight}`"
        class="absolute inset-0"
        :style="{ width: '100%', height: '100%' }"
      >
        <!-- Lines -->
        <line
          v-for="el in elements.filter(e => e.type === 'line')"
          :key="el.id"
          :x1="el.x1"
          :y1="el.y1"
          :x2="el.x2"
          :y2="el.y2"
          :stroke="selectedIds.has(el.id) ? '#f59e0b' : '#6b7280'"
          :stroke-width="selectedIds.has(el.id) ? 3 : 2"
          :transform="rotateTransformComputed(el)"
          @mousedown.stop="onElementMouseDown(el.id, $event)"
        />

        <!-- Rectangles -->
        <rect
          v-for="el in elements.filter(e => e.type === 'rect')"
          :key="el.id"
          :x="el.x"
          :y="el.y"
          :width="el.w"
          :height="el.h"
          :stroke="selectedIds.has(el.id) ? '#f59e0b' : '#6b7280'"
          :stroke-width="selectedIds.has(el.id) ? 3 : 2"
          fill="none"
          :transform="rotateTransformComputed(el)"
          @mousedown.stop="onElementMouseDown(el.id, $event)"
        />

        <!-- Text elements -->
        <text
          v-for="el in elements.filter(e => e.type === 'text')"
          :key="el.id"
          :x="el.x"
          :y="el.y"
          :fill="selectedIds.has(el.id) ? '#f59e0b' : '#9ca3af'"
          font-size="14"
          :transform="rotateTransformComputed(el)"
          @mousedown.stop="onElementMouseDown(el.id, $event)"
        >
          {{ el.text }}
        </text>

        <!-- Channel circles -->
        <g
          v-for="el in elements.filter(e => e.type === 'channel')"
          :key="el.id"
          :data-type="'channel-marker'"
          :data-channel="el.channel"
          @mousedown.stop="onElementMouseDown(el.id, $event)"
        >
          <circle
            :cx="el.x"
            :cy="el.y"
            r="14"
            :stroke="selectedIds.has(el.id) ? '#f59e0b' : '#2563eb'"
            :stroke-width="selectedIds.has(el.id) ? 2.5 : 2"
            fill="#1e3a5f"
          />
          <text
            :x="el.x"
            :y="el.y + 5"
            text-anchor="middle"
            :fill="selectedIds.has(el.id) ? '#f59e0b' : '#60a5fa'"
            font-size="10"
            font-weight="bold"
          >
            {{ el.channel }}
          </text>
        </g>

        <!-- Preview shape during draw -->
        <line
          v-if="preview && activeTool === 'line'"
          :x1="drawStart.x"
          :y1="drawStart.y"
          :x2="preview.x2"
          :y2="preview.y2"
          stroke="#3b82f6"
          stroke-width="2"
          stroke-dasharray="4 4"
        />
        <rect
          v-if="preview && activeTool === 'rect'"
          :x="preview.x"
          :y="preview.y"
          :width="preview.w"
          :height="preview.h"
          stroke="#3b82f6"
          stroke-width="2"
          stroke-dasharray="4 4"
          fill="none"
        />

        <!-- Lasso selection rect -->
        <rect v-if="lassoRect"
          :x="lassoRect.x" :y="lassoRect.y" :width="lassoRect.w" :height="lassoRect.h"
          fill="rgba(59,130,246,0.1)" stroke="#3b82f6" stroke-width="1" stroke-dasharray="4 4"
          pointer-events="none"
        />
      </svg>
    </div>

    <!-- Right Properties Panel -->
    <div
      v-if="selectedIds.size === 1"
      class="w-[180px] bg-gray-900 border-l border-white/10 overflow-y-auto p-4 flex flex-col gap-4"
    >
      <!-- Channel properties -->
      <div v-if="selectedElement && selectedElement.type === 'channel'">
        <h3 class="text-sm font-semibold text-amber-500 mb-2">Kanal</h3>
        <div class="text-xs space-y-1 text-gray-400 mb-3">
          <div v-if="channelInfo">
            <div>{{ channelInfo.device }}</div>
            <div>{{ channelInfo.position }}</div>
            <div>{{ channelInfo.address }}</div>
            <div v-if="channelInfo.color" class="flex items-center gap-2 mt-1">
              <div
                :style="{ backgroundColor: channelInfo.color }"
                class="w-4 h-4 border border-gray-600"
              ></div>
              {{ channelInfo.color }}
            </div>
          </div>
        </div>
        <button
          @click="jumpToChannel"
          class="w-full px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded text-white"
        >
          → Zum Kanal
        </button>
      </div>

      <!-- Text properties -->
      <div v-else-if="selectedElement && selectedElement.type === 'text'">
        <h3 class="text-sm font-semibold text-amber-500 mb-2">Text</h3>
        <input
          v-model="selectedElement.text"
          type="text"
          class="w-full px-2 py-1 bg-gray-800 border border-gray-700 text-white text-sm rounded"
          @input="emitChange"
        />
      </div>

      <!-- Line/Rect properties -->
      <div v-else-if="selectedElement && (selectedElement.type === 'line' || selectedElement.type === 'rect')">
        <p class="text-xs text-gray-400">
          {{ selectedElement.type === 'line' ? 'Linie ausgewählt' : 'Rechteck ausgewählt' }}
        </p>
      </div>

      <!-- Rotation slider (for non-channel elements) -->
      <template v-if="selectedElement && selectedElement.type !== 'channel'">
        <div class="mb-2 mt-3">
          <div class="text-gray-500 uppercase tracking-wide mb-0.5">Rotation</div>
          <input type="range" min="-180" max="180" step="1"
            :value="selectedElement.rotation || 0"
            @input="updateRotation(selectedElement.id, +$event.target.value)"
            class="w-full accent-blue-500"
          />
          <div class="text-gray-400 text-right">{{ selectedElement.rotation || 0 }}°</div>
        </div>
      </template>
    </div>

    <!-- Channel Picker Modal -->
    <div
      v-if="showChannelPicker"
      class="fixed inset-0 bg-black/50 flex items-center justify-center"
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
        <button
          @click="showChannelPicker = false"
          class="mt-3 w-full px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded"
        >
          Abbrechen
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { uuid } from '../utils/uuid.js'

const props = defineProps({
  imageUrl: { type: String, default: null },
  initialSvgData: { type: String, default: null },
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
const svgEl = ref(null)
const canvasEl = ref(null)
const imageUploadInput = ref(null)
const history = ref([])
const historyIndex = ref(-1)
const lassoRect = ref(null)

// Drag state
const dragging = ref(false)
const dragStart = ref(null)
const dragOriginal = ref(null)

// SVG dimensions (assume 1920x1080 standard)
const svgWidth = 1920
const svgHeight = 1080

// Computed
const selectedId = computed(() => selectedIds.value.size === 1 ? [...selectedIds.value][0] : null)
const selectedElement = computed(() => elements.value.find(e => e.id === selectedId.value))
const selectedElements = computed(() => elements.value.filter(e => selectedIds.value.has(e.id)))
const usedChannels = computed(() =>
  elements.value
    .filter(e => e.type === 'channel')
    .map(e => e.channel)
)
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

// Mouse coordinate helper
function getSvgCoords(e) {
  if (!svgEl.value) return { x: 0, y: 0 }
  const svg = svgEl.value
  const pt = svg.createSVGPoint()
  pt.x = e.clientX
  pt.y = e.clientY
  const screenCTM = svg.getScreenCTM()
  if (!screenCTM) return { x: e.clientX, y: e.clientY }
  const transformed = pt.matrixTransform(screenCTM.inverse())
  return { x: transformed.x, y: transformed.y }
}

// Element interaction
function selectElement(id, e) {
  if (activeTool.value !== 'select') return
  if (e?.shiftKey) {
    const s = new Set(selectedIds.value)
    s.has(id) ? s.delete(id) : s.add(id)
    selectedIds.value = s
  } else {
    selectedIds.value = new Set([id])
  }
}

function onElementMouseDown(id, e) {
  e.stopPropagation()
  if (activeTool.value !== 'select') return
  selectElement(id, e)
  startDrag(e)
}

// Drag handling
function startDrag(e) {
  if (activeTool.value !== 'select' || selectedIds.value.size === 0) return
  dragging.value = true
  dragStart.value = getSvgCoords(e)
  const el = selectedElement.value
  dragOriginal.value = { x: el.x || el.x1, y: el.y || el.y1 }
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', onDragEnd)
}

function onDragMove(e) {
  if (!dragging.value || !dragStart.value) return
  const { x, y } = getSvgCoords(e)
  const dx = x - dragStart.value.x
  const dy = y - dragStart.value.y
  dragStart.value = { x, y }
  elements.value.filter(el => selectedIds.value.has(el.id)).forEach(el => {
    if (el.type === 'line') { el.x1 += dx; el.y1 += dy; el.x2 += dx; el.y2 += dy }
    else if (el.type === 'rect') { el.x += dx; el.y += dy }
    else { el.x += dx; el.y += dy }
  })
}

function onDragEnd() {
  if (dragging.value) {
    dragging.value = false
    window.removeEventListener('mousemove', onDragMove)
    window.removeEventListener('mouseup', onDragEnd)
    emitChange()
  }
}

// Canvas mouse handlers
function onCanvasMouseDown(e) {
  // Accept clicks on the SVG, the canvas div, or any SVG child that isn't an interactive element
  const onCanvas = e.target === canvasEl.value || e.target === svgEl.value || e.target.closest('svg') === svgEl.value
  if (!onCanvas) return

  if (activeTool.value === 'select') {
    if (!e.shiftKey) selectedIds.value = new Set()
    drawStart.value = getSvgCoords(e)
  } else if (activeTool.value === 'line' || activeTool.value === 'rect') {
    drawStart.value = getSvgCoords(e)
    preview.value = { x: drawStart.value.x, y: drawStart.value.y, x2: drawStart.value.x, y2: drawStart.value.y, w: 0, h: 0 }
  } else if (activeTool.value === 'channel' || activeTool.value === 'text') {
    drawStart.value = getSvgCoords(e)
  }
}

function onCanvasMouseMove(e) {
  if (!drawStart.value) return

  const current = getSvgCoords(e)
  if (activeTool.value === 'select') {
    lassoRect.value = {
      x: Math.min(current.x, drawStart.value.x),
      y: Math.min(current.y, drawStart.value.y),
      w: Math.abs(current.x - drawStart.value.x),
      h: Math.abs(current.y - drawStart.value.y),
    }
  } else if (activeTool.value === 'line' && preview.value) {
    preview.value.x2 = current.x
    preview.value.y2 = current.y
  } else if (activeTool.value === 'rect' && preview.value) {
    preview.value.x = Math.min(drawStart.value.x, current.x)
    preview.value.y = Math.min(drawStart.value.y, current.y)
    preview.value.w = Math.abs(current.x - drawStart.value.x)
    preview.value.h = Math.abs(current.y - drawStart.value.y)
  }
}

function elementInRect(el, rx, ry, rw, rh) {
  let cx, cy
  if (el.type === 'line') { cx = (el.x1 + el.x2) / 2; cy = (el.y1 + el.y2) / 2 }
  else if (el.type === 'rect') { cx = el.x + el.w / 2; cy = el.y + el.h / 2 }
  else { cx = el.x; cy = el.y }
  return cx >= rx && cx <= rx + rw && cy >= ry && cy <= ry + rh
}

function onCanvasMouseUp(e) {
  if (!drawStart.value) return

  if (activeTool.value === 'select' && lassoRect.value) {
    const { x, y, w, h } = lassoRect.value
    const inLasso = elements.value.filter(el => elementInRect(el, x, y, w, h))
    selectedIds.value = new Set(inLasso.map(e => e.id))
    lassoRect.value = null
    drawStart.value = null
    return
  }

  const current = getSvgCoords(e)
  const distance = Math.sqrt(
    Math.pow(current.x - drawStart.value.x, 2) +
    Math.pow(current.y - drawStart.value.y, 2)
  )

  if (distance > 5) {
    if (activeTool.value === 'line') {
      addElement({
        id: uuid(),
        type: 'line',
        x1: drawStart.value.x,
        y1: drawStart.value.y,
        x2: current.x,
        y2: current.y
      })
      emitChange()
    } else if (activeTool.value === 'rect') {
      const x = Math.min(drawStart.value.x, current.x)
      const y = Math.min(drawStart.value.y, current.y)
      const w = Math.abs(current.x - drawStart.value.x)
      const h = Math.abs(current.y - drawStart.value.y)
      addElement({
        id: uuid(),
        type: 'rect',
        x, y, w, h
      })
      emitChange()
    }
  } else {
    // Click (no drag): handle channel/text placement and deselect
    const coords = getSvgCoords(e)
    if (activeTool.value === 'select') {
      selectedIds.value = new Set()
    } else if (activeTool.value === 'channel') {
      channelPickerPos.value = coords
      channelSearch.value = ''
      showChannelPicker.value = true
    } else if (activeTool.value === 'text') {
      addElement({
        id: uuid(),
        type: 'text',
        x: coords.x,
        y: coords.y,
        text: 'Text'
      })
      emitChange()
    }
  }

  drawStart.value = null
  preview.value = null
  lassoRect.value = null
}

// Element management
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
  addElement({
    id: uuid(),
    type: 'channel',
    x: channelPickerPos.value.x,
    y: channelPickerPos.value.y,
    channel: ch.channel
  })
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

// Rotation helpers
function rotateTransformComputed(el) {
  const deg = el.rotation || 0
  if (!deg) return undefined
  let cx, cy
  if (el.type === 'line') { cx = (el.x1 + el.x2) / 2; cy = (el.y1 + el.y2) / 2 }
  else if (el.type === 'rect') { cx = el.x + el.w / 2; cy = el.y + el.h / 2 }
  else { cx = el.x; cy = el.y }
  return `rotate(${deg},${cx},${cy})`
}

function parseRotation(el) {
  const t = el.getAttribute('transform') || ''
  const m = t.match(/rotate\(([^,)]+)/)
  return m ? parseFloat(m[1]) : 0
}

function rotateAttr(el) {
  const deg = el.rotation || 0
  if (!deg) return ''
  let cx, cy
  if (el.type === 'line') { cx = (el.x1 + el.x2) / 2; cy = (el.y1 + el.y2) / 2 }
  else if (el.type === 'rect') { cx = el.x + el.w / 2; cy = el.y + el.h / 2 }
  else { cx = el.x; cy = el.y }
  return ` transform="rotate(${deg},${cx},${cy})"`
}

// SVG export/import
function exportSvg() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`)
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  for (const el of elements.value) {
    if (el.type === 'line') {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      line.setAttribute('x1', el.x1)
      line.setAttribute('y1', el.y1)
      line.setAttribute('x2', el.x2)
      line.setAttribute('y2', el.y2)
      line.setAttribute('stroke', '#6b7280')
      line.setAttribute('stroke-width', '2')
      line.setAttribute('data-id', el.id)
      line.setAttribute('data-type', 'line')
      if (el.rotation) line.setAttribute('transform', `rotate(${el.rotation},${(el.x1 + el.x2) / 2},${(el.y1 + el.y2) / 2})`)
      svg.appendChild(line)
    } else if (el.type === 'rect') {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      rect.setAttribute('x', el.x)
      rect.setAttribute('y', el.y)
      rect.setAttribute('width', el.w)
      rect.setAttribute('height', el.h)
      rect.setAttribute('stroke', '#6b7280')
      rect.setAttribute('stroke-width', '2')
      rect.setAttribute('fill', 'none')
      rect.setAttribute('data-id', el.id)
      rect.setAttribute('data-type', 'rect')
      if (el.rotation) rect.setAttribute('transform', `rotate(${el.rotation},${el.x + el.w / 2},${el.y + el.h / 2})`)
      svg.appendChild(rect)
    } else if (el.type === 'text') {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      text.setAttribute('x', el.x)
      text.setAttribute('y', el.y)
      text.setAttribute('fill', '#9ca3af')
      text.setAttribute('font-size', '14')
      text.setAttribute('data-id', el.id)
      text.setAttribute('data-type', 'text')
      text.setAttribute('data-text', el.text)
      if (el.rotation) text.setAttribute('transform', `rotate(${el.rotation},${el.x},${el.y})`)
      text.appendChild(document.createTextNode(el.text))
      svg.appendChild(text)
    } else if (el.type === 'channel') {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      g.setAttribute('data-type', 'channel-marker')
      g.setAttribute('data-id', el.id)
      g.setAttribute('data-channel', el.channel)

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      circle.setAttribute('cx', el.x)
      circle.setAttribute('cy', el.y)
      circle.setAttribute('r', '14')
      circle.setAttribute('stroke', '#2563eb')
      circle.setAttribute('stroke-width', '2')
      circle.setAttribute('fill', '#1e3a5f')
      g.appendChild(circle)

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      text.setAttribute('x', el.x)
      text.setAttribute('y', el.y + 5)
      text.setAttribute('text-anchor', 'middle')
      text.setAttribute('fill', '#60a5fa')
      text.setAttribute('font-size', '10')
      text.setAttribute('font-weight', 'bold')
      text.appendChild(document.createTextNode(el.channel))
      g.appendChild(text)

      svg.appendChild(g)
    }
  }

  return new XMLSerializer().serializeToString(svg)
}

function parseSvgData(svgString) {
  if (!svgString) return

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgString, 'image/svg+xml')
    const parsed = []

    const lines = doc.querySelectorAll('line[data-id]')
    lines.forEach(line => {
      parsed.push({
        id: line.getAttribute('data-id'),
        type: 'line',
        x1: parseFloat(line.getAttribute('x1')),
        y1: parseFloat(line.getAttribute('y1')),
        x2: parseFloat(line.getAttribute('x2')),
        y2: parseFloat(line.getAttribute('y2')),
        rotation: parseRotation(line)
      })
    })

    const rects = doc.querySelectorAll('rect[data-id]')
    rects.forEach(rect => {
      parsed.push({
        id: rect.getAttribute('data-id'),
        type: 'rect',
        x: parseFloat(rect.getAttribute('x')),
        y: parseFloat(rect.getAttribute('y')),
        w: parseFloat(rect.getAttribute('width')),
        h: parseFloat(rect.getAttribute('height')),
        rotation: parseRotation(rect)
      })
    })

    const texts = doc.querySelectorAll('text[data-id]')
    texts.forEach(text => {
      parsed.push({
        id: text.getAttribute('data-id'),
        type: 'text',
        x: parseFloat(text.getAttribute('x')),
        y: parseFloat(text.getAttribute('y')),
        text: text.getAttribute('data-text') || text.textContent,
        rotation: parseRotation(text)
      })
    })

    const channels = doc.querySelectorAll('g[data-type="channel-marker"]')
    channels.forEach(g => {
      const circle = g.querySelector('circle')
      if (circle) {
        parsed.push({
          id: g.getAttribute('data-id'),
          type: 'channel',
          x: parseFloat(circle.getAttribute('cx')),
          y: parseFloat(circle.getAttribute('cy')),
          channel: g.getAttribute('data-channel')
        })
      }
    })

    elements.value = parsed
  } catch (err) {
    console.error('Error parsing SVG:', err)
  }
}

function pushHistory() {
  const snap = exportSvg()
  let h = history.value.slice(0, historyIndex.value + 1)
  h.push(snap)
  if (h.length > 50) h = h.slice(-50)
  history.value = h
  historyIndex.value = history.value.length - 1
}

function undo() {
  if (historyIndex.value <= 0) return
  historyIndex.value--
  parseSvgData(history.value[historyIndex.value])
  emit('change', history.value[historyIndex.value])
}

function redo() {
  if (historyIndex.value >= history.value.length - 1) return
  historyIndex.value++
  parseSvgData(history.value[historyIndex.value])
  emit('change', history.value[historyIndex.value])
}

function emitChange() {
  pushHistory()
  emit('change', exportSvg())
}

// Lifecycle
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

watch(() => props.initialSvgData, (newVal) => {
  parseSvgData(newVal)
  history.value = [exportSvg()]
  historyIndex.value = 0
}, { immediate: true })

function isInputFocused() {
  return document.activeElement?.tagName === 'INPUT'
}

// Keyboard handlers
function handleKeyDown(e) {
  if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputFocused()) {
    deleteSelected()
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
}
</script>
