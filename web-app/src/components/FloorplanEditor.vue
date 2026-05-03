<template>
  <div class="relative flex h-full overflow-hidden bg-background text-foreground">
    <!-- Left Toolbar -->
    <div class="w-[56px] bg-muted/30 border-r border-border flex flex-col items-center py-2 gap-1 z-10 shrink-0">
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

      <ToolBtn title="Hintergrundbild hochladen" @click="imageUploadInput?.click()">
        <Upload class="w-5 h-5" />
      </ToolBtn>
      <ToolBtn v-if="bgImage" title="Hintergrundbild entfernen" variant="danger" @click="emit('delete-image')">
        <ImageOff class="w-5 h-5" />
      </ToolBtn>
      <input ref="imageUploadInput" type="file" accept="image/*" class="hidden" @change="onImageFileSelected" />

      <ToolBtn title="Als PNG exportieren" @click="exportPNG">
        <Download class="w-5 h-5" />
      </ToolBtn>

      <div class="flex-1"></div>

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
      :class="(activeTool === 'pan' || spaceHeld) ? 'cursor-grab' : activeTool !== 'select' ? 'cursor-crosshair' : 'cursor-default'"
      :style="isPanning ? 'cursor:grabbing' : ''"
      @mousedown="onContainerMouseDown"
      @mousemove="onContainerMouseMove"
      @mouseup="onContainerMouseUp"
      @dblclick="onContainerDblClick"
    >
      <div 
        class="absolute origin-top-left" 
        :style="{ transform: `translate(${containerOffsetX}px, ${containerOffsetY}px) scale(${stageScale}) translate(${panOffset.x}px, ${panOffset.y}px)`, width: stageSize.width + 'px', height: stageSize.height + 'px' }"
      >
        <svg ref="svgRef" :width="stageSize.width" :height="stageSize.height" class="absolute inset-0 overflow-visible" style="user-select: none;">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#dc3740" />
            </marker>
          </defs>

          <!-- Background image -->
          <image v-if="bgImageSrc" id="bg-image" :href="bgImageSrc" x="0" y="0" :width="stageSize.width" :height="stageSize.height" preserveAspectRatio="none" style="pointer-events: none;" />

          <!-- Grid -->
          <g v-if="showGrid" stroke="rgba(100,100,100,0.3)" stroke-width="1" style="pointer-events: none;">
            <line v-for="x in gridVerticalLines" :key="'gv'+x" :x1="x" :y1="gridTop" :x2="x" :y2="gridBottom" />
            <line v-for="y in gridHorizontalLines" :key="'gh'+y" :x1="gridLeft" :y1="y" :x2="gridRight" :y2="y" />
          </g>

          <!-- Elements -->
          <g v-for="el in elements" :key="el.id" :transform="getTransform(el)" @mousedown.stop="onNodeMouseDown(el.id, $event)">
            <!-- Highlight when selected -->
            <rect v-if="selectedIds.has(el.id) && el.type !== 'line' && el.type !== 'channel'"
                  :x="getBounds(el).x" :y="getBounds(el).y" :width="getBounds(el).w" :height="getBounds(el).h"
                  fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="4,4" />

            <!-- Line -->
            <line v-if="el.type === 'line'" :x1="el.x1" :y1="el.y1" :x2="el.x2" :y2="el.y2" 
                  :stroke="el.color || '#6b7280'" :stroke-width="el.strokeWidth || 2" />
            <!-- Line selection box / invisible hit area -->
            <line v-if="el.type === 'line'" :x1="el.x1" :y1="el.y1" :x2="el.x2" :y2="el.y2" stroke="transparent" stroke-width="16" style="cursor: pointer;" />
            
            <circle v-if="selectedIds.has(el.id) && el.type === 'line'" :cx="el.x1" :cy="el.y1" r="5" fill="#f59e0b" cursor="pointer" @mousedown.stop="startResizeLine(el.id, 1, $event)" />
            <circle v-if="selectedIds.has(el.id) && el.type === 'line'" :cx="el.x2" :cy="el.y2" r="5" fill="#f59e0b" cursor="pointer" @mousedown.stop="startResizeLine(el.id, 2, $event)" />

            <!-- Rect -->
            <rect v-else-if="el.type === 'rect'" :x="el.x" :y="el.y" :width="el.w" :height="el.h" 
                  :fill="el.fill || 'transparent'" :stroke="el.color || '#6b7280'" :stroke-width="el.strokeWidth || 2" style="cursor: pointer;" />

            <!-- Ellipse -->
            <ellipse v-else-if="el.type === 'ellipse'" :cx="el.x" :cy="el.y" :rx="el.rx" :ry="el.ry" 
                     :fill="el.fill || 'transparent'" :stroke="el.color || '#6b7280'" :stroke-width="el.strokeWidth || 2" style="cursor: pointer;" />

            <!-- Text -->
            <text v-else-if="el.type === 'text'" :x="el.x" :y="el.y" :fill="el.color || '#9ca3af'" 
                  :font-size="el.fontSize || 16" :font-weight="el.fontStyle === 'bold' ? 'bold' : 'normal'" 
                  dominant-baseline="hanging" style="cursor: pointer;">{{ el.text }}</text>

            <!-- Channel -->
            <g v-else-if="el.type === 'channel'" style="cursor: pointer;">
              <!-- Selection indicator -->
              <rect v-if="selectedIds.has(el.id)" :x="-pillW(el.channel)/2 - 4" :y="-22" :width="pillW(el.channel) + 8" :height="44" rx="22" fill="none" stroke="#dc3740" stroke-width="2" stroke-dasharray="4,3" />
              <!-- Arrow -->
              <line :x1="getArrowPoints(el.channel, el.rotation).x1" :y1="getArrowPoints(el.channel, el.rotation).y1" 
                    :x2="getArrowPoints(el.channel, el.rotation).x2" :y2="getArrowPoints(el.channel, el.rotation).y2" 
                    stroke="#dc3740" stroke-width="3" marker-end="url(#arrowhead)" />
              <!-- Pill -->
              <rect :x="-pillW(el.channel)/2" y="-18" :width="pillW(el.channel)" :height="36" rx="18" fill="#dc3740" stroke="#dc3740" stroke-width="2" />
              <!-- Text -->
              <text x="0" y="0" fill="#fff" font-size="18" font-weight="bold" text-anchor="middle" dominant-baseline="central">{{ el.channel }}</text>
            </g>

            <!-- Resize handle for rect/ellipse -->
            <circle v-if="selectedIds.has(el.id) && ['rect', 'ellipse'].includes(el.type)"
                    :cx="getBounds(el).x + getBounds(el).w" :cy="getBounds(el).y + getBounds(el).h" 
                    r="5" fill="#f59e0b" cursor="nwse-resize" @mousedown.stop="startResizeRectEllipse(el.id, $event)" />
          </g>

          <!-- Preview shape -->
          <line v-if="preview && activeTool === 'line'" :x1="preview.x1" :y1="preview.y1" :x2="preview.x2" :y2="preview.y2" stroke="#3b82f6" stroke-width="2" stroke-dasharray="4,4" />
          <rect v-if="preview && activeTool === 'rect'" :x="preview.x" :y="preview.y" :width="preview.w" :height="preview.h" stroke="#3b82f6" stroke-width="2" stroke-dasharray="4,4" fill="transparent" />
          <ellipse v-if="preview && activeTool === 'ellipse'" :cx="preview.cx" :cy="preview.cy" :rx="preview.rx" :ry="preview.ry" stroke="#3b82f6" stroke-width="2" stroke-dasharray="4,4" fill="transparent" />

          <!-- Lasso Rect -->
          <rect v-if="lassoRect" :x="lassoRect.x" :y="lassoRect.y" :width="lassoRect.w" :height="lassoRect.h" fill="rgba(59,130,246,0.08)" stroke="#3b82f6" stroke-width="1" stroke-dasharray="2,3" />

          <!-- Notes -->
          <g v-for="el in elementsWithNotes" :key="'note-'+el.id" :transform="`translate(${el._noteX}, ${el._noteY})`" style="pointer-events: none;">
            <polygon points="-6,0 6,0 0,-6" fill="rgba(30,30,30,0.75)" />
            <rect x="-10" y="0" width="100" height="24" fill="rgba(30,30,30,0.75)" rx="3" />
            <text x="-4" y="16" fill="#e5e7eb" font-size="11" font-family="sans-serif">{{ el.notes }}</text>
          </g>
        </svg>
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

      <!-- Floating Properties Panel -->
      <transition name="fade-panel">
        <div
          v-if="selectedIds.size === 1 && selectedElement && floatingPanelPos && !isElementDragging"
          class="absolute z-40 w-64 bg-popover/75 backdrop-blur-md border border-border rounded-lg shadow-xl flex flex-col gap-4.5 p-6 text-sm"
          :style="{ left: floatingPanelPos.left + 'px', top: floatingPanelPos.top + 'px' }"
          @mousedown.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between">
            <span class="font-semibold text-xs uppercase tracking-wide text-muted-foreground">{{ typeLabel(selectedElement.type) }}</span>
            <Button variant="ghost" size="icon" class="h-5 w-5 -mr-1" @click="deleteSelected" title="Löschen">
              <Trash2 class="size-3 text-destructive" />
            </Button>
          </div>

          <!-- Channel info -->
          <template v-if="selectedElement.type === 'channel'">
            <div v-if="channelInfo" class="text-xs space-y-0.5 text-muted-foreground border-b border-border pb-2">
              <div class="font-semibold text-foreground">{{ channelInfo.channel }}</div>
              <div v-if="channelInfo.device">{{ channelInfo.device }}</div>
              <div v-if="channelInfo.position">{{ channelInfo.position }}</div>
              <div v-if="channelInfo.address">{{ channelInfo.address }}</div>
            </div>
            <div class="flex gap-1">
              <Button variant="outline" size="sm" class="h-7 text-xs flex-1" @click="jumpToChannel">→ Zum Kanal</Button>
              <Button variant="outline" size="sm" class="h-7 text-xs flex-1" @click="openReassignPicker">Kanal ändern</Button>
            </div>
          </template>

          <div v-if="selectedElement.type !== 'text'" class="space-y-1">
            <p class="text-xs text-muted-foreground uppercase tracking-wide">Notiz</p>
            <textarea
              v-model="selectedElement.notes"
              placeholder="Notiz hinzufügen…"
              rows="2"
              class="w-full text-xs bg-muted/30 border border-border rounded px-2 py-1.5 resize-none outline-none focus:border-primary"
              @input="emitChange"
            />
          </div>

          <!-- Text editing -->
          <template v-if="selectedElement.type === 'text'">
            <div class="space-y-1.5">
              <Input v-model="selectedElement.text" type="text" class="h-7 px-2 py-1 text-xs" placeholder="Text…" @input="emitChange" />
              <div class="flex items-center gap-1.5">
                <Input v-model.number="selectedElement.fontSize" type="number" min="6" max="200" class="h-7 w-14 px-2 py-1 text-xs" @input="emitChange" />
                <Button size="sm" :variant="selectedElement.fontStyle === 'bold' ? 'default' : 'ghost'" @click="toggleFontStyle(selectedElement)" class="h-7 px-2 text-xs font-bold">B</Button>
                <input type="color" :value="selectedElement.color || '#9ca3af'" @input="e => { selectedElement.color = e.target.value; emitChange() }" class="w-7 h-7 rounded cursor-pointer bg-transparent border border-border p-0.5" />
              </div>
            </div>
          </template>

          <!-- Stroke/fill (line/rect/ellipse) -->
          <template v-if="['line','rect','ellipse'].includes(selectedElement.type)">
            <div class="flex items-center gap-2">
              <input type="color" :value="selectedElement.color || '#6b7280'" @input="e => { selectedElement.color = e.target.value; emitChange() }" class="w-7 h-7 rounded cursor-pointer bg-transparent border border-border p-0.5" />
              <span class="text-xs text-muted-foreground flex-1">Farbe</span>
              <Input v-model.number="selectedElement.strokeWidth" type="number" min="1" max="20" class="h-7 w-12 px-2 py-1 text-xs" @input="emitChange" />
            </div>
            <div v-if="selectedElement.type !== 'line'" class="flex items-center gap-2">
              <input type="color" :value="selectedElement.fill === 'transparent' || !selectedElement.fill ? '#000000' : selectedElement.fill" @input="e => { selectedElement.fill = e.target.value; emitChange() }" class="w-7 h-7 rounded cursor-pointer bg-transparent border border-border p-0.5" />
              <span class="text-xs text-muted-foreground flex-1">Füllung</span>
              <Button variant="outline" size="sm" @click="toggleFill(selectedElement)" class="h-7 px-2 text-xs">
                {{ selectedElement.fill && selectedElement.fill !== 'transparent' ? 'Transparent' : 'Füllen' }}
              </Button>
            </div>
          </template>

          <!-- Rotation -->
          <div class="flex items-center gap-2">
            <Slider
              :model-value="[selectedElement.rotation || 0]"
              @update:model-value="updateRotation(selectedElement.id, $event[0])"
              :min="-180" :max="180" :step="1"
              class="flex-1"
            />
            <span class="text-xs text-muted-foreground w-9 text-right tabular-nums">{{ Math.round(selectedElement.rotation || 0) }}°</span>
          </div>

          <!-- Duplicate -->
          <div class="flex gap-1 flex-wrap border-t border-border pt-2">
            <PanelBtn @click="duplicateSelected" title="Duplizieren"><Copy class="size-3" /></PanelBtn>
          </div>
        </div>
      </transition>

      <!-- Multi-select panel -->
      <transition name="fade-panel">
        <div
          v-if="selectedIds.size > 1"
          class="absolute z-40 bottom-14 left-1/2 -translate-x-1/2 bg-popover/75 backdrop-blur-md border border-border rounded-lg shadow-xl flex items-center gap-3 px-4 py-2 text-sm"
          @mousedown.stop
        >
          <span class="text-muted-foreground text-xs">{{ selectedIds.size }} Elemente ausgewählt</span>
          <Button variant="destructive" size="sm" class="h-7 text-xs" @click="deleteSelected">
            <Trash2 class="size-3 mr-1" />Löschen
          </Button>
        </div>
      </transition>
    </div>

    <div class="absolute top-2 left-[60px] z-20 flex items-center gap-2 bg-background/80 backdrop-blur border border-border rounded p-1">
      <Button size="sm" :variant="showGrid ? 'default' : 'ghost'" @click="showGrid = !showGrid" class="h-7 px-2 text-xs" title="Gitter anzeigen (G)">Gitter</Button>
      <Button size="sm" :variant="snapToGrid ? 'default' : 'ghost'" @click="snapToGrid = !snapToGrid" class="h-7 px-2 text-xs" title="Am Gitter einrasten">Einrasten</Button>
    </div>

    <!-- Reassign Dialog -->
    <Dialog :open="!!reassignTargetId" @update:open="val => { if (!val) reassignTargetId = null }">
      <DialogContent class="w-72 max-h-[28rem] flex flex-col gap-0 p-4">
        <DialogHeader class="mb-3"><DialogTitle class="text-sm">Kanal neu zuweisen</DialogTitle></DialogHeader>
        <Input v-model="channelSearch" type="text" placeholder="Suchen..." class="w-full h-8 mb-3" autofocus />
        <div class="flex-1 overflow-y-auto space-y-1">
          <Button v-for="ch in filteredChannels" :key="ch.channel" variant="ghost" :disabled="usedChannels.includes(ch.channel)" @click="reassignChannel(ch)" class="w-full justify-start px-2 py-1.5 h-auto text-sm" :class="usedChannels.includes(ch.channel) && 'opacity-50'">
            <div><div class="font-semibold">{{ ch.channel }}</div><div class="text-xs text-muted-foreground">{{ ch.device }}</div></div>
          </Button>
        </div>
        <DialogFooter class="mt-3"><Button variant="outline" @click="reassignTargetId = null" class="w-full">Abbrechen</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Channel Picker Dialog -->
    <Dialog :open="showChannelPicker" @update:open="val => { if (!val) showChannelPicker = false }">
      <DialogContent class="w-72 max-h-[28rem] flex flex-col gap-0 p-4">
        <DialogHeader class="mb-3"><DialogTitle class="text-sm">Kanal wählen</DialogTitle></DialogHeader>
        <Input v-model="channelSearch" type="text" placeholder="Suchen..." class="w-full h-8 mb-3" autofocus />
        <div class="flex-1 overflow-y-auto space-y-1">
          <Button v-for="ch in filteredChannels" :key="ch.channel" variant="ghost" :disabled="usedChannels.includes(ch.channel)" @click="placeChannelCircle(ch)" class="w-full justify-start px-2 py-1.5 h-auto text-sm" :class="usedChannels.includes(ch.channel) && 'opacity-50'">
            <div><div class="font-semibold">{{ ch.channel }}</div><div class="text-xs text-muted-foreground">{{ ch.device }}</div></div>
          </Button>
        </div>
        <DialogFooter class="mt-3"><Button variant="outline" @click="showChannelPicker = false" class="w-full">Abbrechen</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick, defineComponent, h } from 'vue'
import { uuid } from '../utils/uuid.js'
import {
  Copy, MousePointer2, Hand, Minus, Square, Circle, Type, CircleDot,
  Upload, ImageOff, Download, Undo2, Redo2, Trash2
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

import ToolBtn from '@/components/ui/ToolBtn.vue'
import PanelBtn from '@/components/ui/PanelBtn.vue'

const props = defineProps({ imageUrl: { type: String, default: null }, initialCanvasData: { type: String, default: null }, channels: { type: Array, default: () => [] } })
const emit = defineEmits(['change', 'jump-to-channel', 'upload-image', 'delete-image', 'snapshot'])

const activeTool = ref('select')
const elements = ref([])
const selectedIds = ref(new Set())
const preview = ref(null)
const drawStart = ref(null)
const showChannelPicker = ref(false)
const channelPickerPos = ref({ x: 0, y: 0 })
const channelSearch = ref('')
const reassignTargetId = ref(null)
const svgRef = ref(null)
const containerEl = ref(null)
const imageUploadInput = ref(null)
const history = ref([])
const historyIndex = ref(-1)
const lassoRect = ref(null)
const pendingDirectionId = ref(null)

const bgImage = ref(null)
const bgImageSrc = ref('')
const containerSize = ref({ width: 1200, height: 800 })
const stageSize = ref({ width: 1200, height: 800 })

const stageScale = computed(() => {
  const sx = containerSize.value.width / stageSize.value.width
  const sy = containerSize.value.height / stageSize.value.height
  return Math.min(sx, sy, 1)
})
const containerOffsetX = computed(() => Math.round((containerSize.value.width - stageSize.value.width * stageScale.value) / 2))
const containerOffsetY = computed(() => Math.round((containerSize.value.height - stageSize.value.height * stageScale.value) / 2))

const showGrid = ref(false)
const snapToGrid = ref(false)
const GRID_SIZE = 30
const panOffset = ref({ x: 0, y: 0 })
const isPanning = ref(false)
const panStart = ref(null)
const spaceHeld = ref(false)
const clipboard = ref(null)
const textEditNode = ref(null)
const textEditValue = ref('')
const textEditStyle = ref({})
const textareaRef = ref(null)

const selectedId = computed(() => selectedIds.value.size === 1 ? [...selectedIds.value][0] : null)
const selectedElement = computed(() => elements.value.find(e => e.id === selectedId.value))
const usedChannels = computed(() => elements.value.filter(e => e.type === 'channel').map(e => e.channel))
const channelInfo = computed(() => {
  if (!selectedElement.value || selectedElement.value.type !== 'channel') return null
  return props.channels.find(ch => ch.channel === selectedElement.value.channel)
})

const NOTE_GAP = 3
const NOTE_CHANNEL_RADIUS = 14
const NOTE_TEXT_BASELINE = 10
const elementsWithNotes = computed(() => {
  return elements.value.filter(el => el.type !== 'text' && el.notes && el.notes.trim()).map(el => {
    let x, y
    if (el.type === 'line') {
      const mx = (el.x1 + el.x2) / 2, my = (el.y1 + el.y2) / 2
      const dx = el.x2 - el.x1, dy = el.y2 - el.y1
      const len = Math.hypot(dx, dy) || 1
      x = mx + (-dy / len) * NOTE_GAP
      y = my + (dx / len) * NOTE_GAP
    } else if (el.type === 'rect') { x = el.x + el.w / 2; y = el.y + el.h + NOTE_GAP } 
    else if (el.type === 'ellipse') { x = el.x; y = el.y + el.ry + NOTE_GAP } 
    else if (el.type === 'channel') { x = el.x; y = el.y + NOTE_CHANNEL_RADIUS + NOTE_GAP } 
    else { x = el.x; y = el.y + NOTE_TEXT_BASELINE + NOTE_GAP }
    return { ...el, _noteX: x, _noteY: y }
  })
})

const filteredChannels = computed(() => {
  const q = channelSearch.value.toLowerCase()
  return props.channels.filter(ch => ch.channel.toLowerCase().includes(q) || (ch.device && ch.device.toLowerCase().includes(q)))
})

const isElementDragging = ref(false)
const isResizing = ref(false)

const floatingPanelPos = computed(() => { 
  if (!selectedElement.value) return null 
  const el = selectedElement.value 
  const px = panOffset.value.x, py = panOffset.value.y 
  let edgeLeft, edgeRight, edgeTop, edgeBottom 
  if (el.type === 'line') { 
    edgeLeft = Math.min(el.x1, el.x2) + px; edgeRight = Math.max(el.x1, el.x2) + px 
    edgeTop = Math.min(el.y1, el.y2) + py; edgeBottom = Math.max(el.y1, el.y2) + py 
  } else if (el.type === 'rect') { 
    edgeLeft = el.x + px; edgeRight = el.x + el.w + px 
    edgeTop = el.y + py; edgeBottom = el.y + el.h + py 
  } else if (el.type === 'ellipse') { 
    edgeLeft = el.x - el.rx + px; edgeRight = el.x + el.rx + px 
    edgeTop = el.y - el.ry + py; edgeBottom = el.y + el.ry + py 
  } else if (el.type === 'channel') {
    const hw = pillW(el.channel) / 2
    edgeLeft = el.x + px - hw; edgeRight = el.x + px + hw
    edgeTop = el.y + py - 14; edgeBottom = el.y + py + 14
  } else { 
    edgeLeft = el.x + px; edgeRight = edgeLeft + 60; edgeTop = el.y + py; edgeBottom = edgeTop + (el.fontSize || 16) 
  }

  const PANEL_W = 256, PANEL_H = 340, MARGIN = 12, GAP = 38
  const s = stageScale.value
  const ox = containerOffsetX.value, oy = containerOffsetY.value
  const containerW = containerSize.value.width, containerH = containerSize.value.height

  let left = edgeRight * s + ox + GAP
  let top = edgeTop * s + oy - GAP
  if (left + PANEL_W > containerW - MARGIN) left = edgeLeft * s + ox - PANEL_W - GAP
  if (top < MARGIN) top = edgeBottom * s + oy + GAP
  if (left < MARGIN) left = MARGIN
  if (top + PANEL_H > containerH - MARGIN) top = containerH - PANEL_H - MARGIN
  if (top < MARGIN) top = MARGIN

  return { left: Math.round(left), top: Math.round(top) }
})

function pillW(_channel) { return 62 }
function typeLabel(type) { return { line: 'Linie', rect: 'Rechteck', ellipse: 'Ellipse', text: 'Text', channel: 'Kanal' }[type] || type }

function getArrowPoints(channel, rot) {
  const rad = (rot || 0) * Math.PI / 180
  const w = pillW(channel)
  const r = 18
  const flatW = w / 2 - r

  const dx = Math.cos(rad)
  const dy = Math.sin(rad)

  let bx = 0, by = 0
  if (Math.abs(dy) > 0.001) {
    const yEdge = dy > 0 ? r : -r
    const xIntersect = yEdge * dx / dy
    if (xIntersect >= -flatW && xIntersect <= flatW) {
      bx = xIntersect
      by = yEdge
    }
  }

  if (bx === 0 && by === 0) {
    const cx = dx > 0 ? flatW : -flatW
    const B = -2 * dx * cx
    const C = cx * cx - r * r
    const disc = B * B - 4 * C
    if (disc >= 0) {
      const t = (-B + Math.sqrt(disc)) / 2
      bx = t * dx
      by = t * dy
    }
  }

  const len = 40
  return { x1: bx, y1: by, x2: bx + dx * len, y2: by + dy * len }
}

function fitToContainer() { panOffset.value = { x: 0, y: 0 } }

watch(() => props.imageUrl, (url) => {
  if (!url) { bgImage.value = null; bgImageSrc.value = ''; return }
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    const MAX = 2000
    const scale = Math.min(1, MAX / img.naturalWidth, MAX / img.naturalHeight)
    stageSize.value = { width: Math.round(img.naturalWidth * scale), height: Math.round(img.naturalHeight * scale) }
    bgImage.value = img
    // We create a canvas to get a base64 version so SVG doesn't throw SecurityError on toDataURL
    const cvs = document.createElement('canvas')
    cvs.width = img.naturalWidth; cvs.height = img.naturalHeight;
    cvs.getContext('2d').drawImage(img, 0, 0)
    bgImageSrc.value = cvs.toDataURL()
    nextTick(fitToContainer)
  }
  img.src = url
}, { immediate: true })

const gridLeft = computed(() => -panOffset.value.x)
const gridTop = computed(() => -panOffset.value.y)
const gridRight = computed(() => gridLeft.value + stageSize.value.width / stageScale.value)
const gridBottom = computed(() => gridTop.value + stageSize.value.height / stageScale.value)
const gridVerticalLines = computed(() => {
  const lines = [], start = Math.floor(gridLeft.value / GRID_SIZE) * GRID_SIZE
  for (let x = start; x <= gridRight.value; x += GRID_SIZE) lines.push(x)
  return lines
})
const gridHorizontalLines = computed(() => {
  const lines = [], start = Math.floor(gridTop.value / GRID_SIZE) * GRID_SIZE
  for (let y = start; y <= gridBottom.value; y += GRID_SIZE) lines.push(y)
  return lines
})

function snap(val) { return snapToGrid.value ? Math.round(val / GRID_SIZE) * GRID_SIZE : val }

function getPointerPos(e) {
  if (!svgRef.value) return { x: 0, y: 0 }
  const rect = svgRef.value.getBoundingClientRect()
  return {
    x: (e.clientX - rect.left) / stageScale.value,
    y: (e.clientY - rect.top) / stageScale.value
  }
}

function getBounds(el) {
  if (el.type === 'rect') return { x: el.x, y: el.y, w: el.w, h: el.h }
  if (el.type === 'ellipse') return { x: el.x - el.rx, y: el.y - el.ry, w: el.rx * 2, h: el.ry * 2 }
  if (el.type === 'text') return { x: el.x - 5, y: el.y - 5, w: (el.fontSize||16)*5, h: (el.fontSize||16)+10 }
  return { x: 0, y: 0, w: 0, h: 0 }
}

function getTransform(el) {
  const rot = el.rotation || 0
  if (!rot) {
    if (el.type === 'channel') return `translate(${el.x}, ${el.y})`
    return ''
  }
  let cx = 0, cy = 0
  if (el.type === 'line') { cx = (el.x1 + el.x2) / 2; cy = (el.y1 + el.y2) / 2 } 
  else if (el.type === 'rect') { cx = el.x + el.w / 2; cy = el.y + el.h / 2 } 
  else if (el.type === 'ellipse') { cx = el.x; cy = el.y } 
  else if (el.type === 'text') { cx = el.x; cy = el.y } 
  else if (el.type === 'channel') {
    return `translate(${el.x}, ${el.y})`
  }
  return `rotate(${rot} ${cx} ${cy})`
}

function onNodeMouseDown(id, e) {
  if (activeTool.value !== 'select') return
  e.stopPropagation()
  if (e.shiftKey) {
    const s = new Set(selectedIds.value)
    s.has(id) ? s.delete(id) : s.add(id)
    selectedIds.value = s
  } else if (!selectedIds.value.has(id)) {
    selectedIds.value = new Set([id])
  }
  
  isElementDragging.value = true
  const pos = getPointerPos(e)
  drawStart.value = pos
  
  // Save initial state for dragging
  clipboard.value = [...selectedIds.value].map(sid => JSON.parse(JSON.stringify(elements.value.find(x => x.id === sid))))
}

let resizeObj = null
function startResizeLine(id, point, e) {
  e.stopPropagation()
  isResizing.value = true
  resizeObj = { id, point }
}
function startResizeRectEllipse(id, e) {
  e.stopPropagation()
  isResizing.value = true
  const el = elements.value.find(x => x.id === id)
  resizeObj = { id, initX: el.x, initY: el.y }
}

function onContainerMouseDown(e) {
  const pos = getPointerPos(e)
  if (activeTool.value === 'pan' || spaceHeld.value) {
    isPanning.value = true
    panStart.value = { mx: e.clientX, my: e.clientY, ox: panOffset.value.x, oy: panOffset.value.y }
    return
  }
  if (activeTool.value === 'select') {
    if (!e.shiftKey) selectedIds.value = new Set()
    drawStart.value = pos
    lassoRect.value = null
    return
  }
  if (['line', 'rect', 'ellipse'].includes(activeTool.value)) {
    drawStart.value = pos
    preview.value = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y, x: pos.x, y: pos.y, w: 0, h: 0, cx: pos.x, cy: pos.y, rx: 0, ry: 0 }
  } else if (activeTool.value === 'channel' || activeTool.value === 'text') {
    drawStart.value = pos
  }
}

function onContainerMouseMove(e) {
  if (isPanning.value && panStart.value) {
    const s = stageScale.value
    panOffset.value = { x: panStart.value.ox + (e.clientX - panStart.value.mx) / s, y: panStart.value.oy + (e.clientY - panStart.value.my) / s }
    return
  }
  
  const pos = getPointerPos(e)

  if (activeTool.value === 'channel-direction' && pendingDirectionId.value) {
    const el = elements.value.find(x => x.id === pendingDirectionId.value)
    if (el) el.rotation = Math.atan2(pos.y - el.y, pos.x - el.x) * 180 / Math.PI
    return
  }

  if (isResizing.value && resizeObj) {
    const el = elements.value.find(x => x.id === resizeObj.id)
    if (el.type === 'line') {
      if (resizeObj.point === 1) { el.x1 = pos.x; el.y1 = pos.y }
      else { el.x2 = pos.x; el.y2 = pos.y }
    } else if (el.type === 'rect') {
      el.w = Math.max(5, pos.x - resizeObj.initX)
      el.h = Math.max(5, pos.y - resizeObj.initY)
    } else if (el.type === 'ellipse') {
      el.rx = Math.max(3, pos.x - resizeObj.initX)
      el.ry = Math.max(3, pos.y - resizeObj.initY)
    }
    return
  }

  if (isElementDragging.value && drawStart.value) {
    const dx = pos.x - drawStart.value.x
    const dy = pos.y - drawStart.value.y
    clipboard.value.forEach(init => {
      const el = elements.value.find(x => x.id === init.id)
      if (!el) return
      if (el.type === 'line') { el.x1 = init.x1 + dx; el.y1 = init.y1 + dy; el.x2 = init.x2 + dx; el.y2 = init.y2 + dy }
      else { el.x = init.x + dx; el.y = init.y + dy }
    })
    return
  }

  if (!drawStart.value) return

  if (activeTool.value === 'select') {
    lassoRect.value = { x: Math.min(pos.x, drawStart.value.x), y: Math.min(pos.y, drawStart.value.y), w: Math.abs(pos.x - drawStart.value.x), h: Math.abs(pos.y - drawStart.value.y) }
  } else if (activeTool.value === 'line') {
    preview.value = { ...preview.value, x2: pos.x, y2: pos.y }
  } else if (activeTool.value === 'rect') {
    preview.value = { x: Math.min(drawStart.value.x, pos.x), y: Math.min(drawStart.value.y, pos.y), w: Math.abs(pos.x - drawStart.value.x), h: Math.abs(pos.y - drawStart.value.y) }
  } else if (activeTool.value === 'ellipse') {
    preview.value = { cx: (drawStart.value.x + pos.x) / 2, cy: (drawStart.value.y + pos.y) / 2, rx: Math.abs(pos.x - drawStart.value.x) / 2, ry: Math.abs(pos.y - drawStart.value.y) / 2 }
  }
}

function onContainerMouseUp(e) {
  if (activeTool.value === 'channel-direction' && pendingDirectionId.value) {
    const el = elements.value.find(x => x.id === pendingDirectionId.value)
    if (el) { el.rotation = Math.atan2(getPointerPos(e).y - el.y, getPointerPos(e).x - el.x) * 180 / Math.PI; emitChange() }
    pendingDirectionId.value = null; activeTool.value = 'select'
    return
  }
  if (isPanning.value) { isPanning.value = false; panStart.value = null; return }
  if (isResizing.value) { 
    isResizing.value = false; resizeObj = null
    elements.value.forEach(el => {
      if(el.type === 'line'){ el.x1=snap(el.x1); el.y1=snap(el.y1); el.x2=snap(el.x2); el.y2=snap(el.y2) }
      else if (el.type === 'rect') { el.w=snap(el.w); el.h=snap(el.h) }
      else if (el.type === 'ellipse') { el.rx=snap(el.rx); el.ry=snap(el.ry) }
    })
    emitChange()
    return
  }
  if (isElementDragging.value) {
    isElementDragging.value = false
    elements.value.forEach(el => {
      if(!selectedIds.value.has(el.id)) return
      if(el.type === 'line'){ el.x1=snap(el.x1); el.y1=snap(el.y1); el.x2=snap(el.x2); el.y2=snap(el.y2) }
      else { el.x=snap(el.x); el.y=snap(el.y) }
    })
    drawStart.value = null
    emitChange()
    return
  }

  if (!drawStart.value) return
  const pos = getPointerPos(e)
  const dist = Math.hypot(pos.x - drawStart.value.x, pos.y - drawStart.value.y)

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
    lassoRect.value = null; drawStart.value = null
    return
  }

  if (dist > 5) {
    if (activeTool.value === 'line') { addElement({ id: uuid(), type: 'line', x1: snap(drawStart.value.x), y1: snap(drawStart.value.y), x2: snap(pos.x), y2: snap(pos.y), rotation: 0, color: '#6b7280', strokeWidth: 2 }); emitChange() }
    else if (activeTool.value === 'rect') { addElement({ id: uuid(), type: 'rect', x: snap(Math.min(drawStart.value.x, pos.x)), y: snap(Math.min(drawStart.value.y, pos.y)), w: snap(Math.abs(pos.x - drawStart.value.x)), h: snap(Math.abs(pos.y - drawStart.value.y)), rotation: 0, color: '#6b7280', strokeWidth: 2, fill: 'transparent' }); emitChange() }
    else if (activeTool.value === 'ellipse') { addElement({ id: uuid(), type: 'ellipse', x: snap((drawStart.value.x + pos.x) / 2), y: snap((drawStart.value.y + pos.y) / 2), rx: snap(Math.abs(pos.x - drawStart.value.x) / 2), ry: snap(Math.abs(pos.y - drawStart.value.y) / 2), rotation: 0, color: '#6b7280', strokeWidth: 2, fill: 'transparent' }); emitChange() }
    activeTool.value = 'select'
  } else {
    if (activeTool.value === 'channel') {
      channelPickerPos.value = { x: snap(drawStart.value.x), y: snap(drawStart.value.y) }
      channelSearch.value = ''; showChannelPicker.value = true
    } else if (activeTool.value === 'text') {
      addElement({ id: uuid(), type: 'text', x: snap(drawStart.value.x), y: snap(drawStart.value.y), text: 'Text', rotation: 0, color: '#9ca3af', fontSize: 16, fontStyle: 'normal' })
      emitChange(); activeTool.value = 'select'
    } else if (activeTool.value === 'select') {
      selectedIds.value = new Set()
    }
  }

  drawStart.value = null; preview.value = null; lassoRect.value = null
}

function resetView() { if (bgImage.value) fitToContainer(); else panOffset.value = { x: 0, y: 0 } }

function onContainerDblClick(e) {
  if (activeTool.value !== 'select') return
  if (selectedIds.value.size === 1) {
    const el = elements.value.find(x => x.id === [...selectedIds.value][0])
    if (el?.type === 'text') {
      textEditNode.value = el
      textEditValue.value = el.text
      const CTM = svgRef.value.getScreenCTM()
      const box = containerEl.value.getBoundingClientRect()
      textEditStyle.value = {
        top: (CTM.f + el.y * CTM.d - box.top) + 'px',
        left: (CTM.e + el.x * CTM.a - box.left) + 'px',
        minWidth: '80px', fontSize: (el.fontSize || 16) + 'px', transform: `rotate(${el.rotation || 0}deg)`, transformOrigin: '0 0'
      }
      nextTick(() => textareaRef.value?.focus())
    }
  }
}

function commitTextEdit() {
  if (!textEditNode.value) return
  const el = elements.value.find(e => e.id === textEditNode.value.id)
  if (el) { el.text = textEditValue.value; emitChange() }
  textEditNode.value = null
}
function cancelTextEdit() { textEditNode.value = null }

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
    elements.value.push(newEl); newIds.add(newEl.id)
  })
  selectedIds.value = newIds; emitChange()
}
function duplicateSelected() { copySelected(); pasteClipboard() }
function addElement(el) { elements.value.push(el) }
function deleteSelected() {
  if (selectedIds.value.size === 0) return
  elements.value = elements.value.filter(e => !selectedIds.value.has(e.id))
  selectedIds.value = new Set(); emitChange()
}
function placeChannelCircle(ch) {
  const id = uuid()
  addElement({ id, type: 'channel', x: channelPickerPos.value.x, y: channelPickerPos.value.y, channel: ch.channel, rotation: 0 })
  showChannelPicker.value = false; pendingDirectionId.value = id; activeTool.value = 'channel-direction'; emitChange()
}
function onImageFileSelected(e) {
  const file = e.target.files?.[0]; if (file) emit('upload-image', file); e.target.value = ''
}
function jumpToChannel() { if (selectedElement.value?.type === 'channel') emit('jump-to-channel', selectedElement.value.channel) }
function openReassignPicker() { if (selectedElement.value?.type === 'channel') { reassignTargetId.value = selectedElement.value.id; channelSearch.value = '' } }
function reassignChannel(ch) {
  const el = elements.value.find(e => e.id === reassignTargetId.value)
  if (el) { el.channel = ch.channel; emitChange() }
  reassignTargetId.value = null
}
function updateRotation(id, deg) { const el = elements.value.find(e => e.id === id); if (el) { el.rotation = deg; emitChange() } }
function toggleFontStyle(el) { el.fontStyle = el.fontStyle === 'bold' ? 'normal' : 'bold'; emitChange() }
function toggleFill(el) { el.fill = (el.fill && el.fill !== 'transparent') ? 'transparent' : '#ffffff'; emitChange() }
function exportData() { return JSON.stringify(elements.value) }
function parseData(str) { if (!str) return; try { elements.value = JSON.parse(str) } catch {} }

function pushHistory() {
  const snap = exportData()
  let h = history.value.slice(0, historyIndex.value + 1)
  h.push(snap); if (h.length > 100) h = h.slice(-100)
  history.value = h; historyIndex.value = history.value.length - 1
}
async function captureSnapshot() {
  if (!svgRef.value) return null
  const canvas = document.createElement('canvas')
  canvas.width = stageSize.value.width; canvas.height = stageSize.value.height
  const ctx = canvas.getContext('2d')
  if (bgImage.value) ctx.drawImage(bgImage.value, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.8)
}
function undo() {
  if (historyIndex.value <= 0) return
  historyIndex.value--; parseData(history.value[historyIndex.value])
  captureSnapshot().then(snap => emit('change', history.value[historyIndex.value], snap))
}
function redo() {
  if (historyIndex.value >= history.value.length - 1) return
  historyIndex.value++; parseData(history.value[historyIndex.value])
  captureSnapshot().then(snap => emit('change', history.value[historyIndex.value], snap))
}
function emitChange() {
  pushHistory()
  const data = exportData()
  captureSnapshot().then(snap => emit('change', data, snap))
}
function exportPNG() {
  const canvas = document.createElement('canvas')
  canvas.width = stageSize.value.width * 2; canvas.height = stageSize.value.height * 2
  const ctx = canvas.getContext('2d'); ctx.scale(2, 2)
  if (bgImage.value) ctx.drawImage(bgImage.value, 0, 0, stageSize.value.width, stageSize.value.height)
  
  const svg = svgRef.value.cloneNode(true)
  const bgImgNode = svg.querySelector('#bg-image')
  if (bgImgNode) bgImgNode.remove()
  let svgStr = new XMLSerializer().serializeToString(svg)
  if (!svgStr.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) svgStr = svgStr.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"')
  
  const img = new Image()
  img.onload = () => {
    ctx.drawImage(img, 0, 0)
    const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = 'grundriss.png'; a.click()
  }
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr)
}

function isInputFocused() { const el = document.activeElement; return el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || !!el?.isContentEditable }
function handleKeyDown(e) {
  if (isInputFocused()) return
  if (e.key === ' ') { e.preventDefault(); spaceHeld.value = true; return }
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
    if (e.key === 'Escape') { if(activeTool.value==='channel-direction') pendingDirectionId.value=null; activeTool.value = 'select'; selectedIds.value = new Set(); return }
    if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelected(); return }
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key) && selectedIds.value.size > 0) {
      e.preventDefault(); const step = e.shiftKey ? 10 : 1
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
      elements.value.forEach(el => {
        if (!selectedIds.value.has(el.id)) return
        if (el.type === 'line') { el.x1 += dx; el.y1 += dy; el.x2 += dx; el.y2 += dy } else { el.x = (el.x || 0) + dx; el.y = (el.y || 0) + dy }
      })
      emitChange(); return
    }
  }
  if ((e.ctrlKey || e.metaKey)) {
    if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return }
    if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); return }
    if (e.key === 'c') { e.preventDefault(); copySelected(); return }
    if (e.key === 'v') { e.preventDefault(); pasteClipboard(); return }
    if (e.key === 'd') { e.preventDefault(); duplicateSelected(); return }
    if (e.key === 'a') { e.preventDefault(); selectedIds.value = new Set(elements.value.map(e => e.id)); return }
    if (e.key === '0') { e.preventDefault(); resetView(); return }
  }
}
function handleKeyUp(e) { if (e.key === ' ') spaceHeld.value = false }

let resizeObserver = null
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  if (containerEl.value) {
    resizeObserver = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) containerSize.value = { width, height }
    })
    resizeObserver.observe(containerEl.value)
  }
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  resizeObserver?.disconnect()
})

watch(() => props.initialCanvasData, (newVal) => {
  parseData(newVal); history.value = [exportData()]; historyIndex.value = 0
}, { immediate: true })
</script>

<style scoped>
@reference "../style.css";
.fade-panel-enter-active, .fade-panel-leave-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.fade-panel-enter-from, .fade-panel-leave-to { opacity: 0; transform: scale(0.95); }
</style>
