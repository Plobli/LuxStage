<template>
  <div class="relative flex h-full overflow-hidden bg-background text-foreground" @keydown.prevent.stop>
    <!-- Left Toolbar -->
    <div class="w-[56px] bg-muted/30 border-r border-border flex flex-col items-center py-2 gap-1 z-10 shrink-0">
      <!-- Tools -->
      <ToolBtn :active="activeTool === 'select'" title="Auswählen (V)" @click="activeTool = 'select'">
        <MousePointer2 class="w-5 h-5" />
      </ToolBtn>
      <ToolBtn :active="activeTool === 'pan'" title="Verschieben (H)" @click="activeTool = 'pan'">
        <Hand class="w-5 h-5" />
      </ToolBtn>
      <Separator class="w-8 my-1" />
      <ToolBtn :active="activeTool === 'line'" title="Linie (L)" @click="activeTool = 'line'">
        <Minus class="w-5 h-5 rotate-45" />
      </ToolBtn>
      <ToolBtn :active="activeTool === 'rect'" title="Rechteck (R)" @click="activeTool = 'rect'">
        <Square class="w-5 h-5" />
      </ToolBtn>
      <ToolBtn :active="activeTool === 'ellipse'" title="Ellipse (E)" @click="activeTool = 'ellipse'">
        <Circle class="w-5 h-5" />
      </ToolBtn>
      <ToolBtn :active="activeTool === 'text'" title="Text (T)" @click="activeTool = 'text'">
        <Type class="w-5 h-5" />
      </ToolBtn>
      <ToolBtn :active="activeTool === 'channel'" title="Kanal platzieren (C)" @click="activeTool = 'channel'">
        <CircleDot class="w-5 h-5" />
      </ToolBtn>
      <Separator class="w-8 my-1" />

      <!-- Image Upload -->
      <ToolBtn title="Hintergrundbild hochladen" @click="imageUploadInput?.click()">
        <Upload class="w-5 h-5" />
      </ToolBtn>
      <ToolBtn v-if="bgImage" title="Hintergrundbild entfernen" variant="danger" @click="emit('delete-image')">
        <ImageOff class="w-5 h-5" />
      </ToolBtn>
      <input ref="imageUploadInput" type="file" accept="image/*" class="hidden" @change="onImageFileSelected" />

      <!-- Export -->
      <ToolBtn title="Als PNG exportieren" @click="exportPNG">
        <Download class="w-5 h-5" />
      </ToolBtn>

      <div class="flex-1"></div>

      <!-- Undo/Redo -->
      <ToolBtn :disabled="historyIndex <= 0" title="Rückgängig (Ctrl+Z)" @click="undo">
        <Undo2 class="w-5 h-5" />
      </ToolBtn>
      <ToolBtn :disabled="historyIndex >= history.length - 1" title="Wiederholen (Ctrl+Y)" @click="redo">
        <Redo2 class="w-5 h-5" />
      </ToolBtn>
      <ToolBtn :disabled="selectedIds.size === 0" variant="danger" title="Auswahl löschen (Delete)" @click="deleteSelected">
        <Trash2 class="w-5 h-5" />
      </ToolBtn>
    </div>

    <!-- Center Canvas -->
    <div
      ref="containerEl"
      class="flex-1 relative overflow-hidden"
      :class="activeTool === 'pan' ? 'cursor-grab' : activeTool !== 'select' ? 'cursor-crosshair' : 'cursor-default'"
      :style="activeTool === 'pan' && isPanning ? 'cursor:grabbing' : ''"
    >
      <!-- Grid overlay (behind stage) -->
      <canvas
        v-if="showGrid"
        ref="gridCanvasRef"
        class="absolute inset-0 pointer-events-none z-0"
        :width="stageSize.width"
        :height="stageSize.height"
      />

      <v-stage
        ref="stageRef"
        :config="stageConfig"
        class="absolute top-0 left-0 z-10"
        @mousedown="onStageMouseDown"
        @mousemove="onStageMouseMove"
        @mouseup="onStageMouseUp"
        @wheel="onWheel"
        @dblclick="onStageDblClick"
      >
        <!-- Background image layer -->
        <v-layer :config="{ listening: false }">
          <v-image v-if="bgImage" :config="{ image: bgImage, width: bgImage.naturalWidth, height: bgImage.naturalHeight }" />
        </v-layer>

        <!-- Elements layer -->
        <v-layer ref="elementsLayerRef">
          <!-- Lines -->
          <v-line
            v-for="el in lines"
            :key="el.id"
            :ref="el => setNodeRef(el, el?.getNode?.()?.id?.() ?? el?.config?.id)"
            :config="{
              id: el.id,
              points: [el.x1, el.y1, el.x2, el.y2],
              stroke: el.color || '#6b7280',
              strokeWidth: el.strokeWidth || 2,
              rotation: el.rotation || 0,
              offsetX: (el.x1 + el.x2) / 2,
              offsetY: (el.y1 + el.y2) / 2,
              x: (el.x1 + el.x2) / 2,
              y: (el.y1 + el.y2) / 2,
              draggable: activeTool === 'select',
              hitStrokeWidth: 12,
            }"
            @click="onNodeClick(el.id, $event)"
            @dragstart="e => e.cancelBubble = true"
            @dragend="onLineDragEnd(el, $event)"
            @transformend="onLineTransformEnd(el, $event)"
          />

          <!-- Rectangles -->
          <v-rect
            v-for="el in rects"
            :key="el.id"
            :config="{
              id: el.id,
              x: el.x + el.w / 2,
              y: el.y + el.h / 2,
              width: el.w,
              height: el.h,
              stroke: el.color || '#6b7280',
              strokeWidth: el.strokeWidth || 2,
              fill: el.fill || 'transparent',
              rotation: el.rotation || 0,
              offsetX: el.w / 2,
              offsetY: el.h / 2,
              draggable: activeTool === 'select',
            }"
            @click="onNodeClick(el.id, $event)"
            @dragstart="e => e.cancelBubble = true"
            @dragend="onRectDragEnd(el, $event)"
            @transformend="onRectTransformEnd(el, $event)"
          />

          <!-- Ellipses -->
          <v-ellipse
            v-for="el in ellipses"
            :key="el.id"
            :config="{
              id: el.id,
              x: el.x,
              y: el.y,
              radiusX: el.rx,
              radiusY: el.ry,
              stroke: el.color || '#6b7280',
              strokeWidth: el.strokeWidth || 2,
              fill: el.fill || 'transparent',
              rotation: el.rotation || 0,
              draggable: activeTool === 'select',
            }"
            @click="onNodeClick(el.id, $event)"
            @dragstart="e => e.cancelBubble = true"
            @dragend="onSimpleDragEnd(el, $event)"
            @transformend="onEllipseTransformEnd(el, $event)"
          />

          <!-- Text elements -->
          <v-text
            v-for="el in texts"
            :key="el.id"
            :config="{
              id: el.id,
              x: el.x,
              y: el.y,
              text: el.text,
              fill: el.color || '#9ca3af',
              fontSize: el.fontSize || 16,
              fontStyle: el.fontStyle || 'normal',
              rotation: el.rotation || 0,
              draggable: activeTool === 'select',
            }"
            @click="onNodeClick(el.id, $event)"
            @dragstart="e => e.cancelBubble = true"
            @dragend="onSimpleDragEnd(el, $event)"
            @transformend="onTextTransformEnd(el, $event)"
            @dblclick="startTextEdit(el, $event)"
          />

          <!-- Channel markers -->
          <v-group
            v-for="el in channelEls"
            :key="el.id"
            :config="{
              id: el.id,
              x: el.x,
              y: el.y,
              draggable: activeTool === 'select',
            }"
            @click="onNodeClick(el.id, $event)"
            @dragstart="e => e.cancelBubble = true"
            @dragend="onSimpleDragEnd(el, $event)"
          >
            <v-circle :config="{
              radius: 14,
              stroke: '#2563eb',
              strokeWidth: 2,
              fill: '#1e3a5f',
            }" />
            <v-text :config="{
              text: el.channel,
              fontSize: 10,
              fontStyle: 'bold',
              fill: '#60a5fa',
              align: 'center',
              verticalAlign: 'middle',
              width: 28,
              height: 28,
              offsetX: 14,
              offsetY: 14,
              listening: false,
            }" />
          </v-group>

          <!-- Konva Transformer -->
          <v-transformer
            ref="transformerRef"
            :config="{
              rotateEnabled: true,
              resizeEnabled: true,
              borderStroke: '#f59e0b',
              borderStrokeWidth: 1.5,
              anchorStroke: '#f59e0b',
              anchorFill: '#1f2937',
              anchorSize: 10,
              anchorCornerRadius: 2,
              keepRatio: false,
              rotationSnaps: showGrid ? [0, 45, 90, 135, 180, 225, 270, 315] : [],
              rotationSnapTolerance: 8,
            }"
          />

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
          <v-ellipse
            v-if="preview && activeTool === 'ellipse'"
            :config="{
              x: preview.cx,
              y: preview.cy,
              radiusX: preview.rx,
              radiusY: preview.ry,
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
              fill: 'rgba(59,130,246,0.08)',
              stroke: '#3b82f6',
              strokeWidth: 1,
              dash: [4, 4],
              listening: false,
            }"
          />
        </v-layer>
      </v-stage>

      <!-- Zoom indicator -->
      <div class="absolute bottom-2 left-2 z-20 flex items-center gap-1 bg-background/80 backdrop-blur border border-border rounded px-2 py-1 text-xs text-muted-foreground select-none pointer-events-none">
        {{ Math.round(zoom * 100) }}%
      </div>

      <!-- Zoom controls -->
      <div class="absolute bottom-2 right-2 z-20 flex items-center gap-1 bg-background/80 backdrop-blur border border-border rounded p-1">
        <Button variant="ghost" size="icon" @click="setZoom(zoom * 1.25)" class="h-6 w-6">+</Button>
        <Button variant="ghost" size="sm" @click="setZoom(1); panOffset.value = { x: 0, y: 0 }" class="h-6 px-2 text-xs">1:1</Button>
        <Button variant="ghost" size="icon" @click="setZoom(zoom * 0.8)" class="h-6 w-6">−</Button>
      </div>

      <!-- Inline Text Editor -->
      <textarea
        v-if="textEditNode"
        ref="textareaRef"
        v-model="textEditValue"
        class="absolute z-30 bg-popover/90 border border-primary text-popover-foreground p-1 resize-none outline-none rounded text-sm shadow-md"
        :style="textEditStyle"
        @blur="commitTextEdit"
        @keydown.enter.prevent="commitTextEdit"
        @keydown.escape="cancelTextEdit"
      />
    </div>

    <!-- Right Properties Panel -->
    <transition name="slide-panel">
      <div
        v-if="selectedIds.size >= 1"
        class="w-[200px] bg-muted/10 border-l border-border flex flex-col gap-3 p-3 overflow-y-auto shrink-0"
      >
        <!-- Multi-select summary -->
        <div v-if="selectedIds.size > 1" class="text-xs text-muted-foreground">
          <div class="text-primary font-semibold text-sm mb-1">{{ selectedIds.size }} Elemente</div>
          <div class="flex gap-1 flex-wrap mt-2">
            <PanelBtn @click="bringToFront" title="Ganz nach vorne"><ChevronsUp class="size-3 mr-1" />Vorne</PanelBtn>
            <PanelBtn @click="sendToBack" title="Ganz nach hinten"><ChevronsDown class="size-3 mr-1" />Hinten</PanelBtn>
          </div>
        </div>

        <!-- Single element -->
        <template v-if="selectedIds.size === 1 && selectedElement">
          <div class="text-primary font-semibold text-sm capitalize">{{ typeLabel(selectedElement.type) }}</div>

          <!-- Channel info -->
          <div v-if="selectedElement.type === 'channel'">
            <div class="text-xs space-y-1 text-muted-foreground mb-2">
              <template v-if="channelInfo">
                <div class="font-semibold text-foreground">{{ channelInfo.channel }}</div>
                <div>{{ channelInfo.device }}</div>
                <div>{{ channelInfo.position }}</div>
                <div>{{ channelInfo.address }}</div>
                <div v-if="channelInfo.color" class="flex items-center gap-2 mt-1">
                  <div :style="{ backgroundColor: channelInfo.color }" class="w-4 h-4 rounded border border-border"></div>
                  {{ channelInfo.color }}
                </div>
              </template>
            </div>
            <PanelBtn @click="jumpToChannel" class="w-full">→ Zum Kanal</PanelBtn>
          </div>

          <!-- Text editing -->
          <div v-if="selectedElement.type === 'text'" class="space-y-2">
            <p class="text-xs text-muted-foreground uppercase tracking-wide">Text</p>
            <Input v-model="selectedElement.text" type="text" class="h-7 px-2 py-1 text-xs" @input="emitChange" />
            <p class="text-xs text-muted-foreground uppercase tracking-wide">Schriftgröße</p>
            <Input v-model.number="selectedElement.fontSize" type="number" min="6" max="200" class="h-7 w-16 px-2 py-1 text-xs" @input="emitChange" />
            <div class="flex gap-1">
              <Toggle
                size="sm"
                :pressed="selectedElement.fontStyle === 'bold'"
                @click="toggleFontStyle(selectedElement)"
                class="h-7 px-2 text-xs font-bold"
              >B</Toggle>
            </div>
          </div>

          <!-- Stroke color (line/rect/ellipse) -->
          <div v-if="['line','rect','ellipse'].includes(selectedElement.type)" class="space-y-2">
            <p class="text-xs text-muted-foreground uppercase tracking-wide">Farbe</p>
            <div class="flex items-center gap-2">
              <input type="color" :value="selectedElement.color || '#6b7280'" @input="e => { selectedElement.color = e.target.value; emitChange() }" class="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
              <span class="text-xs text-muted-foreground">{{ selectedElement.color || '#6b7280' }}</span>
            </div>
            <p class="text-xs text-muted-foreground uppercase tracking-wide">Stärke</p>
            <Input v-model.number="selectedElement.strokeWidth" type="number" min="1" max="20" class="h-7 w-16 px-2 py-1 text-xs" @input="emitChange" />
            <template v-if="selectedElement.type !== 'line'">
              <p class="text-xs text-muted-foreground uppercase tracking-wide">Füllung</p>
              <div class="flex items-center gap-2">
                <input type="color" :value="selectedElement.fill === 'transparent' || !selectedElement.fill ? '#000000' : selectedElement.fill" @input="e => { selectedElement.fill = e.target.value; emitChange() }" class="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                <Button variant="outline" size="sm" @click="toggleFill(selectedElement)" class="h-7 px-2 text-xs">
                  {{ selectedElement.fill && selectedElement.fill !== 'transparent' ? 'Transparent' : 'Füllen' }}
                </Button>
              </div>
            </template>
          </div>

          <!-- Text color -->
          <div v-if="selectedElement.type === 'text'" class="space-y-2">
            <p class="text-xs text-muted-foreground uppercase tracking-wide">Farbe</p>
            <div class="flex items-center gap-2">
              <input type="color" :value="selectedElement.color || '#9ca3af'" @input="e => { selectedElement.color = e.target.value; emitChange() }" class="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
            </div>
          </div>

          <!-- Position & size -->
          <template v-if="selectedElement.type !== 'channel'">
            <p class="text-xs text-muted-foreground uppercase tracking-wide">Rotation</p>
            <div class="flex items-center gap-2 pt-1 pb-2">
              <Slider
                :model-value="[selectedElement.rotation || 0]"
                @update:model-value="updateRotation(selectedElement.id, $event[0])"
                :min="-180"
                :max="180"
                :step="1"
                class="flex-1"
              />
              <span class="text-xs text-muted-foreground w-9 text-right">{{ Math.round(selectedElement.rotation || 0) }}°</span>
            </div>
          </template>

          <!-- Z-Order -->
          <div class="flex gap-1 flex-wrap mt-1">
            <PanelBtn @click="bringToFront"><ChevronsUp class="size-3 mr-1" />Vorne</PanelBtn>
            <PanelBtn @click="bringForward"><ChevronUp class="size-3 mr-1" />Vor</PanelBtn>
            <PanelBtn @click="sendBackward"><ChevronDown class="size-3 mr-1" />Zurück</PanelBtn>
            <PanelBtn @click="sendToBack"><ChevronsDown class="size-3 mr-1" />Hinten</PanelBtn>
          </div>

          <!-- Copy/Duplicate -->
          <div class="flex gap-1">
            <PanelBtn @click="duplicateSelected" class="flex-1"><Copy class="size-3 mr-1" />Duplizieren</PanelBtn>
          </div>
        </template>
      </div>
    </transition>

    <!-- Top bar options -->
    <div class="absolute top-2 left-[60px] z-20 flex items-center gap-2 bg-background/80 backdrop-blur border border-border rounded p-1">
      <Toggle
        size="sm"
        :pressed="showGrid"
        @click="showGrid = !showGrid"
        class="h-7 px-2 text-xs"
        title="Gitter anzeigen (G)"
      >
        Gitter
      </Toggle>
      <Toggle
        size="sm"
        :pressed="snapToGrid"
        @click="snapToGrid = !snapToGrid"
        class="h-7 px-2 text-xs"
        title="Am Gitter einrasten"
      >
        Einrasten
      </Toggle>
      <Separator orientation="vertical" class="h-4" />
      <Button
        variant="ghost"
        size="sm"
        @click="resetView"
        class="h-7 px-2 text-xs"
        title="Ansicht zurücksetzen (F)"
      >
        Ansicht ↺
      </Button>
    </div>

    <!-- Channel Picker Dialog -->
    <Dialog :open="showChannelPicker" @update:open="val => { if (!val) showChannelPicker = false }">
      <DialogContent class="w-72 max-h-[28rem] flex flex-col gap-0 p-4">
        <DialogHeader class="mb-3">
          <DialogTitle class="text-sm">Kanal wählen</DialogTitle>
        </DialogHeader>
        <Input
          v-model="channelSearch"
          type="text"
          placeholder="Suchen..."
          class="w-full h-8 mb-3"
          autofocus
        />
        <div class="flex-1 overflow-y-auto space-y-1">
          <Button
            v-for="ch in filteredChannels"
            :key="ch.channel"
            variant="ghost"
            :disabled="usedChannels.includes(ch.channel)"
            @click="placeChannelCircle(ch)"
            class="w-full justify-start px-2 py-1.5 h-auto text-sm"
            :class="usedChannels.includes(ch.channel) && 'opacity-50'"
          >
            <div>
              <div class="font-semibold">{{ ch.channel }}</div>
              <div class="text-xs text-muted-foreground">{{ ch.device }}</div>
            </div>
          </Button>
        </div>
        <DialogFooter class="mt-3">
          <Button variant="outline" @click="showChannelPicker = false" class="w-full">
            Abbrechen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick, defineComponent, h } from 'vue'
import { uuid } from '../utils/uuid.js'
import jsPDF from 'jspdf'
import {
  ChevronsUp, ChevronsDown, ChevronUp, ChevronDown, Copy,
  MousePointer2, Hand, Minus, Square, Circle, Type, CircleDot,
  Upload, ImageOff, Download, Undo2, Redo2, Trash2
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { Toggle } from '@/components/ui/toggle'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

// --------------- Sub-components ---------------
const ToolBtn = defineComponent({
  props: { active: Boolean, disabled: Boolean, variant: String, title: String },
  emits: ['click'],
  setup(props, { slots, emit }) {
    return () => h(Button, {
      title: props.title,
      disabled: props.disabled,
      variant: props.variant === 'danger' ? 'destructive' : (props.active ? 'default' : 'ghost'),
      size: 'icon',
      onClick: () => !props.disabled && emit('click'),
      class: 'w-10 h-10'
    }, slots.default)
  }
})

const PanelBtn = defineComponent({
  props: { title: String, class: String },
  emits: ['click'],
  setup(props, { slots, emit }) {
    return () => h(Button, {
      variant: 'outline',
      size: 'sm',
      title: props.title,
      onClick: () => emit('click'),
      class: ['h-7 text-xs px-2', props.class]
    }, slots.default)
  }
})

// --------------- Props / Emits ---------------
const props = defineProps({
  imageUrl: { type: String, default: null },
  initialCanvasData: { type: String, default: null },
  channels: { type: Array, default: () => [] }
})
const emit = defineEmits(['change', 'jump-to-channel', 'upload-image', 'delete-image'])

// --------------- State ---------------
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
const transformerRef = ref(null)
const containerEl = ref(null)
const gridCanvasRef = ref(null)
const imageUploadInput = ref(null)
const history = ref([])
const historyIndex = ref(-1)
const lassoRect = ref(null)
const bgImage = ref(null)
const stageSize = ref({ width: 1200, height: 800 })
const showGrid = ref(false)
const snapToGrid = ref(false)
const GRID_SIZE = 40
const zoom = ref(1)
const panOffset = ref({ x: 0, y: 0 })
const isPanning = ref(false)
const panStart = ref(null)
const clipboard = ref(null)
// Text editing
const textEditNode = ref(null)
const textEditValue = ref('')
const textEditStyle = ref({})
const textareaRef = ref(null)

// --------------- Computed element groups ---------------
const lines = computed(() => elements.value.filter(e => e.type === 'line'))
const rects = computed(() => elements.value.filter(e => e.type === 'rect'))
const ellipses = computed(() => elements.value.filter(e => e.type === 'ellipse'))
const texts = computed(() => elements.value.filter(e => e.type === 'text'))
const channelEls = computed(() => elements.value.filter(e => e.type === 'channel'))

// --------------- Stage config ---------------
const stageConfig = computed(() => ({
  width: stageSize.value.width,
  height: stageSize.value.height,
  scaleX: zoom.value,
  scaleY: zoom.value,
  x: panOffset.value.x,
  y: panOffset.value.y,
}))

// --------------- Computed ---------------
const selectedId = computed(() => selectedIds.value.size === 1 ? [...selectedIds.value][0] : null)
const selectedElement = computed(() => elements.value.find(e => e.id === selectedId.value))
const usedChannels = computed(() => elements.value.filter(e => e.type === 'channel').map(e => e.channel))
const channelInfo = computed(() => {
  if (!selectedElement.value || selectedElement.value.type !== 'channel') return null
  return props.channels.find(ch => ch.channel === selectedElement.value.channel)
})
const filteredChannels = computed(() => {
  const q = channelSearch.value.toLowerCase()
  return props.channels.filter(ch =>
    ch.channel.toLowerCase().includes(q) ||
    (ch.device && ch.device.toLowerCase().includes(q))
  )
})

function typeLabel(type) {
  return { line: 'Linie', rect: 'Rechteck', ellipse: 'Ellipse', text: 'Text', channel: 'Kanal' }[type] || type
}

// --------------- Background image ---------------
watch(() => props.imageUrl, (url) => {
  if (!url) { bgImage.value = null; return }
  const img = new Image()
  img.onload = () => { bgImage.value = img }
  img.src = url
}, { immediate: true })

// --------------- Grid drawing ---------------
function drawGrid() {
  const c = gridCanvasRef.value
  if (!c) return
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, c.width, c.height)
  if (!showGrid.value) return
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 1
  const gs = GRID_SIZE * zoom.value
  const ox = panOffset.value.x % gs
  const oy = panOffset.value.y % gs
  for (let x = ox; x < c.width; x += gs) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, c.height); ctx.stroke()
  }
  for (let y = oy; y < c.height; y += gs) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(c.width, y); ctx.stroke()
  }
}
watch([showGrid, zoom, panOffset, stageSize], () => nextTick(drawGrid), { deep: true, immediate: true })

// --------------- Snap to grid ---------------
function snap(val) {
  return snapToGrid.value ? Math.round(val / GRID_SIZE) * GRID_SIZE : val
}

// --------------- Transformer ---------------
function updateTransformer() {
  nextTick(() => {
    const tr = transformerRef.value?.getNode()
    const layer = elementsLayerRef.value?.getNode()
    if (!tr || !layer) return
    // Only attach transformer for non-channel, single or multi-select
    const transformable = [...selectedIds.value].map(id => {
      const el = elements.value.find(e => e.id === id)
      if (!el || el.type === 'channel') return null
      return layer.findOne(`#${id}`)
    }).filter(Boolean)
    tr.nodes(transformable)
    tr.getLayer()?.batchDraw()
  })
}
watch(selectedIds, updateTransformer, { deep: true })

// --------------- Pointer position in canvas coordinates ---------------
function getPointerPos() {
  const stage = stageRef.value?.getNode()
  if (!stage) return { x: 0, y: 0 }
  const pos = stage.getPointerPosition()
  if (!pos) return { x: 0, y: 0 }
  // Convert from screen coords to canvas coords accounting for pan & zoom
  return {
    x: (pos.x - panOffset.value.x) / zoom.value,
    y: (pos.y - panOffset.value.y) / zoom.value,
  }
}

// --------------- Node click ---------------
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

// --------------- Stage mouse handlers ---------------
function onStageMouseDown(e) {
  const stage = stageRef.value?.getNode()
  if (!stage) return
  const clickedOnStage = e.target === stage || e.target.getType() === 'Layer'

  const pos = getPointerPos()

  if (activeTool.value === 'pan') {
    isPanning.value = true
    panStart.value = { mx: e.evt.clientX, my: e.evt.clientY, ox: panOffset.value.x, oy: panOffset.value.y }
    return
  }

  if (activeTool.value === 'select') {
    if (clickedOnStage && !e.evt.shiftKey) selectedIds.value = new Set()
    if (clickedOnStage) drawStart.value = pos
    lassoRect.value = null
    return
  }

  if (!clickedOnStage) return

  if (activeTool.value === 'line' || activeTool.value === 'rect' || activeTool.value === 'ellipse') {
    drawStart.value = pos
    preview.value = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y, x: pos.x, y: pos.y, w: 0, h: 0, cx: pos.x, cy: pos.y, rx: 0, ry: 0 }
  } else if (activeTool.value === 'channel' || activeTool.value === 'text') {
    drawStart.value = pos
  }
}

function onStageMouseMove(e) {
  if (isPanning.value && panStart.value) {
    const dx = e.evt.clientX - panStart.value.mx
    const dy = e.evt.clientY - panStart.value.my
    panOffset.value = { x: panStart.value.ox + dx, y: panStart.value.oy + dy }
    return
  }

  if (!drawStart.value) return
  const pos = getPointerPos()

  if (activeTool.value === 'select') {
    lassoRect.value = {
      x: Math.min(pos.x, drawStart.value.x),
      y: Math.min(pos.y, drawStart.value.y),
      w: Math.abs(pos.x - drawStart.value.x),
      h: Math.abs(pos.y - drawStart.value.y),
    }
    return
  }
  if (activeTool.value === 'line') {
    preview.value = { ...preview.value, x2: pos.x, y2: pos.y }
  } else if (activeTool.value === 'rect') {
    preview.value = {
      x: Math.min(drawStart.value.x, pos.x),
      y: Math.min(drawStart.value.y, pos.y),
      w: Math.abs(pos.x - drawStart.value.x),
      h: Math.abs(pos.y - drawStart.value.y),
    }
  } else if (activeTool.value === 'ellipse') {
    preview.value = {
      cx: (drawStart.value.x + pos.x) / 2,
      cy: (drawStart.value.y + pos.y) / 2,
      rx: Math.abs(pos.x - drawStart.value.x) / 2,
      ry: Math.abs(pos.y - drawStart.value.y) / 2,
    }
  }
}

function onStageMouseUp(e) {
  if (isPanning.value) {
    isPanning.value = false
    panStart.value = null
    return
  }

  if (!drawStart.value) return
  const pos = getPointerPos()
  const dx = pos.x - drawStart.value.x
  const dy = pos.y - drawStart.value.y
  const dist = Math.sqrt(dx * dx + dy * dy)

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

  if (dist > 5) {
    if (activeTool.value === 'line') {
      addElement({ id: uuid(), type: 'line', x1: snap(drawStart.value.x), y1: snap(drawStart.value.y), x2: snap(pos.x), y2: snap(pos.y), rotation: 0, color: '#6b7280', strokeWidth: 2 })
      emitChange()
    } else if (activeTool.value === 'rect') {
      addElement({
        id: uuid(), type: 'rect',
        x: snap(Math.min(drawStart.value.x, pos.x)),
        y: snap(Math.min(drawStart.value.y, pos.y)),
        w: snap(Math.abs(pos.x - drawStart.value.x)),
        h: snap(Math.abs(pos.y - drawStart.value.y)),
        rotation: 0, color: '#6b7280', strokeWidth: 2, fill: 'transparent'
      })
      emitChange()
    } else if (activeTool.value === 'ellipse') {
      addElement({
        id: uuid(), type: 'ellipse',
        x: snap((drawStart.value.x + pos.x) / 2),
        y: snap((drawStart.value.y + pos.y) / 2),
        rx: snap(Math.abs(pos.x - drawStart.value.x) / 2),
        ry: snap(Math.abs(pos.y - drawStart.value.y) / 2),
        rotation: 0, color: '#6b7280', strokeWidth: 2, fill: 'transparent'
      })
      emitChange()
    }
    activeTool.value = 'select'
  } else {
    if (activeTool.value === 'channel') {
      channelPickerPos.value = { x: snap(drawStart.value.x), y: snap(drawStart.value.y) }
      channelSearch.value = ''
      showChannelPicker.value = true
    } else if (activeTool.value === 'text') {
      addElement({ id: uuid(), type: 'text', x: snap(drawStart.value.x), y: snap(drawStart.value.y), text: 'Text', rotation: 0, color: '#9ca3af', fontSize: 16, fontStyle: 'normal' })
      emitChange()
      activeTool.value = 'select'
    } else if (activeTool.value === 'select') {
      selectedIds.value = new Set()
    }
  }

  drawStart.value = null
  preview.value = null
  lassoRect.value = null
}

// --------------- Zoom / Pan ---------------
function onWheel(e) {
  e.evt.preventDefault()
  const delta = e.evt.deltaY < 0 ? 1.1 : 0.9
  const stage = stageRef.value?.getNode()
  if (!stage) return
  const pointer = stage.getPointerPosition()
  const newZoom = Math.max(0.1, Math.min(10, zoom.value * delta))
  // Zoom towards pointer
  const ox = pointer.x - (pointer.x - panOffset.value.x) * (newZoom / zoom.value)
  const oy = pointer.y - (pointer.y - panOffset.value.y) * (newZoom / zoom.value)
  zoom.value = newZoom
  panOffset.value = { x: ox, y: oy }
}

function setZoom(z) {
  const center = { x: stageSize.value.width / 2, y: stageSize.value.height / 2 }
  const newZoom = Math.max(0.1, Math.min(10, z))
  const ox = center.x - (center.x - panOffset.value.x) * (newZoom / zoom.value)
  const oy = center.y - (center.y - panOffset.value.y) * (newZoom / zoom.value)
  zoom.value = newZoom
  panOffset.value = { x: ox, y: oy }
}

function resetView() {
  zoom.value = 1
  panOffset.value = { x: 0, y: 0 }
}

// --------------- Double-click: text editing ---------------
function onStageDblClick(e) {
  if (activeTool.value !== 'select') return
  const clickedId = e.target?.id?.()
  if (!clickedId) return
  const el = elements.value.find(x => x.id === clickedId)
  if (el?.type === 'text') startTextEdit(el, e)
}

function startTextEdit(el, e) {
  e.cancelBubble = true
  const node = e.target
  const stage = stageRef.value?.getNode()
  if (!stage) return
  const absPos = node.getAbsolutePosition()
  const stageBox = stage.container().getBoundingClientRect()
  textEditNode.value = el
  textEditValue.value = el.text
  textEditStyle.value = {
    top: (stageBox.top + absPos.y - containerEl.value.getBoundingClientRect().top) + 'px',
    left: (stageBox.left + absPos.x - containerEl.value.getBoundingClientRect().left) + 'px',
    minWidth: '100px',
    fontSize: ((el.fontSize || 16) * zoom.value) + 'px',
    transform: `rotate(${el.rotation || 0}deg)`,
  }
  nextTick(() => textareaRef.value?.focus())
}

function commitTextEdit() {
  if (!textEditNode.value) return
  const el = elements.value.find(e => e.id === textEditNode.value.id)
  if (el) { el.text = textEditValue.value; emitChange() }
  textEditNode.value = null
}

function cancelTextEdit() {
  textEditNode.value = null
}

// --------------- Drag handlers ---------------
function onLineDragEnd(el, e) {
  e.cancelBubble = true
  const node = e.target
  const dx = node.x(); const dy = node.y()
  el.x1 = snap(el.x1 + dx); el.y1 = snap(el.y1 + dy)
  el.x2 = snap(el.x2 + dx); el.y2 = snap(el.y2 + dy)
  node.position({ x: 0, y: 0 })
  emitChange()
}

function onRectDragEnd(el, e) {
  e.cancelBubble = true
  const node = e.target
  el.x = snap(node.x() - el.w / 2)
  el.y = snap(node.y() - el.h / 2)
  node.position({ x: el.x + el.w / 2, y: el.y + el.h / 2 })
  emitChange()
}

function onSimpleDragEnd(el, e) {
  e.cancelBubble = true
  const node = e.target
  el.x = snap(node.x()); el.y = snap(node.y())
  emitChange()
}

// --------------- Transform end handlers ---------------
function onLineTransformEnd(el, e) {
  const node = e.target
  el.rotation = node.rotation()
  node.rotation(0)
  emitChange()
}

function onRectTransformEnd(el, e) {
  const node = e.target
  el.x = node.x() - node.width() * node.scaleX() / 2
  el.y = node.y() - node.height() * node.scaleY() / 2
  el.w = Math.max(5, node.width() * node.scaleX())
  el.h = Math.max(5, node.height() * node.scaleY())
  el.rotation = node.rotation()
  node.scaleX(1); node.scaleY(1)
  node.offsetX(el.w / 2); node.offsetY(el.h / 2)
  node.x(el.x + el.w / 2); node.y(el.y + el.h / 2)
  emitChange()
}

function onEllipseTransformEnd(el, e) {
  const node = e.target
  el.x = node.x(); el.y = node.y()
  el.rx = Math.max(3, node.radiusX() * node.scaleX())
  el.ry = Math.max(3, node.radiusY() * node.scaleY())
  el.rotation = node.rotation()
  node.scaleX(1); node.scaleY(1)
  emitChange()
}

function onTextTransformEnd(el, e) {
  const node = e.target
  el.x = node.x(); el.y = node.y()
  if (node.scaleX() !== 1) {
    el.fontSize = Math.max(6, Math.round((el.fontSize || 16) * node.scaleX()))
    node.scaleX(1); node.scaleY(1)
  }
  el.rotation = node.rotation()
  emitChange()
}

// --------------- Z-Order ---------------
function bringToFront() {
  const ids = selectedIds.value
  const rest = elements.value.filter(e => !ids.has(e.id))
  const sel = elements.value.filter(e => ids.has(e.id))
  elements.value = [...rest, ...sel]
  emitChange()
}

function bringForward() {
  const ids = selectedIds.value
  const arr = [...elements.value]
  for (let i = arr.length - 2; i >= 0; i--) {
    if (ids.has(arr[i].id) && !ids.has(arr[i + 1].id)) {
      ;[arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]
    }
  }
  elements.value = arr
  emitChange()
}

function sendBackward() {
  const ids = selectedIds.value
  const arr = [...elements.value]
  for (let i = 1; i < arr.length; i++) {
    if (ids.has(arr[i].id) && !ids.has(arr[i - 1].id)) {
      ;[arr[i], arr[i - 1]] = [arr[i - 1], arr[i]]
    }
  }
  elements.value = arr
  emitChange()
}

function sendToBack() {
  const ids = selectedIds.value
  const rest = elements.value.filter(e => !ids.has(e.id))
  const sel = elements.value.filter(e => ids.has(e.id))
  elements.value = [...sel, ...rest]
  emitChange()
}

// --------------- Copy / Paste / Duplicate ---------------
function copySelected() {
  if (selectedIds.value.size === 0) return
  clipboard.value = elements.value.filter(e => selectedIds.value.has(e.id)).map(e => ({ ...e }))
}

function pasteClipboard() {
  if (!clipboard.value?.length) return
  const newIds = new Set()
  clipboard.value.forEach(el => {
    const newEl = { ...el, id: uuid(), x: (el.x ?? el.x1 ?? 0) + 20, y: (el.y ?? el.y1 ?? 0) + 20 }
    if (el.x1 !== undefined) { newEl.x1 = el.x1 + 20; newEl.y1 = el.y1 + 20; newEl.x2 = el.x2 + 20; newEl.y2 = el.y2 + 20 }
    elements.value.push(newEl)
    newIds.add(newEl.id)
  })
  selectedIds.value = newIds
  emitChange()
}

function duplicateSelected() {
  copySelected()
  pasteClipboard()
}

// --------------- Other operations ---------------
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
  activeTool.value = 'select'
  emitChange()
}

function onImageFileSelected(e) {
  const file = e.target.files?.[0]
  if (file) emit('upload-image', file)
  e.target.value = ''
}

function jumpToChannel() {
  if (selectedElement.value?.type === 'channel') emit('jump-to-channel', selectedElement.value.channel)
}

function updateRotation(id, deg) {
  const el = elements.value.find(e => e.id === id)
  if (el) { el.rotation = deg; emitChange() }
}

function toggleFontStyle(el) {
  el.fontStyle = el.fontStyle === 'bold' ? 'normal' : 'bold'
  emitChange()
}

function toggleFill(el) {
  el.fill = (el.fill && el.fill !== 'transparent') ? 'transparent' : '#ffffff'
  emitChange()
}

// --------------- Export / Import ---------------
function exportData() {
  return JSON.stringify(elements.value)
}

function parseData(str) {
  if (!str) return
  try { elements.value = JSON.parse(str) } catch {}
}

// --------------- History ---------------
function pushHistory() {
  const snap = exportData()
  let h = history.value.slice(0, historyIndex.value + 1)
  h.push(snap)
  if (h.length > 100) h = h.slice(-100)
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

// --------------- PNG / PDF Export ---------------
function exportPNG() {
  const stage = stageRef.value?.getNode()
  if (!stage) return
  const saved = { x: stage.x(), y: stage.y(), scaleX: stage.scaleX(), scaleY: stage.scaleY() }
  stage.x(0); stage.y(0); stage.scaleX(1); stage.scaleY(1)
  const dataUrl = stage.toDataURL({ pixelRatio: 2, width: 1920, height: 1080 })
  stage.x(saved.x); stage.y(saved.y); stage.scaleX(saved.scaleX); stage.scaleY(saved.scaleY)
  const a = document.createElement('a'); a.href = dataUrl; a.download = 'grundriss.png'; a.click()
}

function exportPDF() {
  const stage = stageRef.value?.getNode()
  if (!stage) return
  const saved = { x: stage.x(), y: stage.y(), scaleX: stage.scaleX(), scaleY: stage.scaleY() }
  stage.x(0); stage.y(0); stage.scaleX(1); stage.scaleY(1)
  const dataUrl = stage.toDataURL({ pixelRatio: 2, width: 1920, height: 1080 })
  stage.x(saved.x); stage.y(saved.y); stage.scaleX(saved.scaleX); stage.scaleY(saved.scaleY)
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pw = pdf.internal.pageSize.getWidth()
  const ph = pdf.internal.pageSize.getHeight()
  pdf.addImage(dataUrl, 'PNG', 0, 0, pw, ph)
  pdf.save('grundriss.pdf')
}

// --------------- Keyboard shortcuts ---------------
function isInputFocused() {
  const tag = document.activeElement?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA'
}

function handleKeyDown(e) {
  if (isInputFocused()) return

  // Tool shortcuts
  if (!e.ctrlKey && !e.metaKey) {
    if (e.key === 'v' || e.key === 'V') { activeTool.value = 'select'; return }
    if (e.key === 'h' || e.key === 'H') { activeTool.value = 'pan'; return }
    if (e.key === 'l' || e.key === 'L') { activeTool.value = 'line'; return }
    if (e.key === 'r' || e.key === 'R') { activeTool.value = 'rect'; return }
    if (e.key === 'e' || e.key === 'E') { activeTool.value = 'ellipse'; return }
    if (e.key === 't' || e.key === 'T') { activeTool.value = 'text'; return }
    if (e.key === 'c' && activeTool.value !== 'select') { activeTool.value = 'channel'; return }
    if (e.key === 'g' || e.key === 'G') { showGrid.value = !showGrid.value; return }
    if (e.key === 'f' || e.key === 'F') { resetView(); return }
    if (e.key === 'Escape') { activeTool.value = 'select'; selectedIds.value = new Set(); return }
    if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelected(); return }

    // Nudge with arrow keys
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key) && selectedIds.value.size > 0) {
      e.preventDefault()
      const step = e.shiftKey ? 10 : 1
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
      elements.value.forEach(el => {
        if (!selectedIds.value.has(el.id)) return
        if (el.type === 'line') { el.x1 += dx; el.y1 += dy; el.x2 += dx; el.y2 += dy }
        else { el.x = (el.x || 0) + dx; el.y = (el.y || 0) + dy }
      })
      emitChange()
      return
    }
  }

  if ((e.ctrlKey || e.metaKey)) {
    if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return }
    if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); return }
    if (e.key === 'c') { e.preventDefault(); copySelected(); return }
    if (e.key === 'v') { e.preventDefault(); pasteClipboard(); return }
    if (e.key === 'd') { e.preventDefault(); duplicateSelected(); return }
    if (e.key === 'a') { e.preventDefault(); selectedIds.value = new Set(elements.value.map(e => e.id)); return }
    if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom(zoom.value * 1.25); return }
    if (e.key === '-') { e.preventDefault(); setZoom(zoom.value * 0.8); return }
    if (e.key === '0') { e.preventDefault(); resetView(); return }
  }
}

// --------------- Lifecycle ---------------
let resizeObserver = null

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  if (containerEl.value) {
    resizeObserver = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) stageSize.value = { width, height }
    })
    resizeObserver.observe(containerEl.value)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  resizeObserver?.disconnect()
})

watch(() => props.initialCanvasData, (newVal) => {
  parseData(newVal)
  history.value = [exportData()]
  historyIndex.value = 0
}, { immediate: true })
</script>

<style scoped>
@reference "../style.css";

.slide-panel-enter-active,
.slide-panel-leave-active {
  transition: width 0.15s ease, opacity 0.15s ease;
}
.slide-panel-enter-from,
.slide-panel-leave-to {
  width: 0;
  opacity: 0;
  overflow: hidden;
}
</style>
