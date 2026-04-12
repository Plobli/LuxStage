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

      <!-- Spacer -->
      <div class="flex-1"></div>

      <!-- Delete button -->
      <button
        @click="deleteSelected"
        :disabled="!selectedId"
        :class="['p-2 rounded hover:bg-gray-800', selectedId ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 text-gray-500 cursor-not-allowed']"
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
      @click="onCanvasClick"
    >
      <!-- Background image -->
      <img
        v-if="imageUrl"
        :src="imageUrl"
        class="absolute inset-0 object-contain"
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
          :stroke="selectedId === el.id ? '#f59e0b' : '#6b7280'"
          :stroke-width="selectedId === el.id ? 3 : 2"
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
          :stroke="selectedId === el.id ? '#f59e0b' : '#6b7280'"
          :stroke-width="selectedId === el.id ? 3 : 2"
          fill="none"
          @mousedown.stop="onElementMouseDown(el.id, $event)"
        />

        <!-- Text elements -->
        <text
          v-for="el in elements.filter(e => e.type === 'text')"
          :key="el.id"
          :x="el.x"
          :y="el.y"
          :fill="selectedId === el.id ? '#f59e0b' : '#9ca3af'"
          font-size="14"
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
            :stroke="selectedId === el.id ? '#f59e0b' : '#2563eb'"
            :stroke-width="selectedId === el.id ? 3 : 2"
            fill="#1e3a5f"
          />
          <text
            :x="el.x"
            :y="el.y + 5"
            text-anchor="middle"
            :fill="selectedId === el.id ? '#f59e0b' : '#60a5fa'"
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
      </svg>
    </div>

    <!-- Right Properties Panel -->
    <div
      v-if="selectedId"
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

const emit = defineEmits(['change', 'jump-to-channel'])

// State
const activeTool = ref('select')
const elements = ref([])
const selectedId = ref(null)
const preview = ref(null)
const drawStart = ref(null)
const showChannelPicker = ref(false)
const channelPickerPos = ref({ x: 0, y: 0 })
const channelSearch = ref('')
const svgEl = ref(null)
const canvasEl = ref(null)

// Drag state
const dragging = ref(false)
const dragStart = ref(null)
const dragOriginal = ref(null)

// SVG dimensions (assume 1920x1080 standard)
const svgWidth = 1920
const svgHeight = 1080

// Computed
const selectedElement = computed(() => elements.value.find(e => e.id === selectedId.value))
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
function selectElement(id) {
  selectedId.value = id
}

function onElementMouseDown(id, e) {
  e.stopPropagation()
  if (activeTool.value !== 'select') return
  selectElement(id)
  startDrag(e)
}

// Drag handling
function startDrag(e) {
  if (activeTool.value !== 'select' || !selectedId.value) return
  dragging.value = true
  dragStart.value = getSvgCoords(e)
  const el = selectedElement.value
  dragOriginal.value = { x: el.x || el.x1, y: el.y || el.y1 }
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', onDragEnd)
}

function onDragMove(e) {
  if (!dragging.value || !dragStart.value || !selectedElement.value) return
  const current = getSvgCoords(e)
  const dx = current.x - dragStart.value.x
  const dy = current.y - dragStart.value.y

  const el = selectedElement.value
  if (el.type === 'line') {
    el.x1 = dragOriginal.value.x + dx
    el.y1 = dragOriginal.value.y + dy
    el.x2 += dx
    el.y2 += dy
  } else if (el.type === 'rect') {
    el.x = dragOriginal.value.x + dx
    el.y = dragOriginal.value.y + dy
  } else if (el.type === 'text' || el.type === 'channel') {
    el.x = dragOriginal.value.x + dx
    el.y = dragOriginal.value.y + dy
  }
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
  if (activeTool.value === 'select' && e.target === canvasEl.value) {
    selectedId.value = null
  }
  if ((activeTool.value === 'line' || activeTool.value === 'rect') && e.target === svgEl.value) {
    drawStart.value = getSvgCoords(e)
    preview.value = { x: drawStart.value.x, y: drawStart.value.y, x2: drawStart.value.x, y2: drawStart.value.y, w: 0, h: 0 }
  }
}

function onCanvasMouseMove(e) {
  if (!drawStart.value || !preview.value) return

  const current = getSvgCoords(e)
  if (activeTool.value === 'line') {
    preview.value.x2 = current.x
    preview.value.y2 = current.y
  } else if (activeTool.value === 'rect') {
    preview.value.x = Math.min(drawStart.value.x, current.x)
    preview.value.y = Math.min(drawStart.value.y, current.y)
    preview.value.w = Math.abs(current.x - drawStart.value.x)
    preview.value.h = Math.abs(current.y - drawStart.value.y)
  }
}

function onCanvasMouseUp(e) {
  if (!drawStart.value) return

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
    }
    emitChange()
  }

  drawStart.value = null
  preview.value = null
}

function onCanvasClick(e) {
  if (e.target !== svgEl.value && e.target !== canvasEl.value) return

  const coords = getSvgCoords(e)

  if (activeTool.value === 'channel') {
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

// Element management
function addElement(el) {
  elements.value.push(el)
}

function deleteSelected() {
  if (!selectedId.value) return
  elements.value = elements.value.filter(e => e.id !== selectedId.value)
  selectedId.value = null
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

function jumpToChannel() {
  if (selectedElement.value?.type === 'channel') {
    emit('jump-to-channel', selectedElement.value.channel)
  }
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
        y2: parseFloat(line.getAttribute('y2'))
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
        h: parseFloat(rect.getAttribute('height'))
      })
    })

    const texts = doc.querySelectorAll('text[data-id]')
    texts.forEach(text => {
      parsed.push({
        id: text.getAttribute('data-id'),
        type: 'text',
        x: parseFloat(text.getAttribute('x')),
        y: parseFloat(text.getAttribute('y')),
        text: text.getAttribute('data-text') || text.textContent
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

function emitChange() {
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
}, { immediate: true })

function isInputFocused() {
  return document.activeElement?.tagName === 'INPUT'
}

// Keyboard handlers
function handleKeyDown(e) {
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId.value && !isInputFocused()) {
    deleteSelected()
  }
}
</script>
