<template>
  <div class="relative flex h-full overflow-hidden bg-background text-foreground">
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
      :class="(activeTool === 'pan' || spaceHeld) ? 'cursor-grab' : activeTool !== 'select' ? 'cursor-crosshair' : 'cursor-default'"
      :style="isPanning ? 'cursor:grabbing' : ''"
    >
      <v-stage
        ref="stageRef"
        :config="stageConfig"
        class="absolute top-0 left-0 z-10"
        @mousedown="onStageMouseDown"
        @mousemove="onStageMouseMove"
        @mouseup="onStageMouseUp"
        @dblclick="onStageDblClick"
      >
        <!-- Background image layer -->
        <v-layer :config="{ listening: false }">
          <v-image
            v-if="bgImage"
            :config="{
              image: bgImage,
              x: bgImageRect.x,
              y: bgImageRect.y,
              width: bgImageRect.width,
              height: bgImageRect.height,
            }"
          />
        </v-layer>

        <!-- Grid layer (über dem Bild) -->
        <v-layer v-if="showGrid" :config="{ listening: false }">
          <v-line
            v-for="x in gridVerticalLines"
            :key="'gv' + x"
            :config="{ points: [x, gridTop, x, gridBottom], stroke: 'rgba(100,100,100,0.3)', strokeWidth: 1 }"
          />
          <v-line
            v-for="y in gridHorizontalLines"
            :key="'gh' + y"
            :config="{ points: [gridLeft, y, gridRight, y], stroke: 'rgba(100,100,100,0.3)', strokeWidth: 1 }"
          />
        </v-layer>

        <!-- Elements layer -->
        <v-layer ref="elementsLayerRef">
          <!-- Lines -->
          <v-line
            v-for="el in lines"
            :key="el.id"
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
            @dragstart="e => { e.cancelBubble = true; draggingElementId = el.id; isElementDragging = true }"
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
            @dragstart="e => { e.cancelBubble = true; draggingElementId = el.id; isElementDragging = true }"
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
            @dragstart="e => { e.cancelBubble = true; draggingElementId = el.id; isElementDragging = true }"
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
            @dragstart="e => { e.cancelBubble = true; draggingElementId = el.id; isElementDragging = true }"
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
              onClick: (e) => onNodeClick(el.id, e),
              onDragstart: (e) => { e.cancelBubble = true; draggingElementId = el.id; isElementDragging = true },
              onDragend: (e) => onSimpleDragEnd(el, e),
            }"
          >
            <v-circle v-if="selectedIds.has(el.id)" :config="{
              radius: 20,
              stroke: '#dc3740',
              strokeWidth: 2,
              fill: 'transparent',
              dash: [4, 3],
              listening: false,
            }" />
            <v-circle :config="{
              radius: 14,
              stroke: '#dc3740',
              strokeWidth: 2,
              fill: '#dc3740',
            }" />
            <v-text :config="{
              text: el.channel,
              fontSize: 16,
              fontStyle: 'bold',
              fill: '#fff',
              align: 'center',
              verticalAlign: 'middle',
              width: 28,
              height: 28,
              offsetX: 14,
              offsetY: 14,
              listening: false,
            }" />
            <v-arrow :config="{
              points: [14, 0, 30, 0],
              pointerLength: 7,
              pointerWidth: 7,
              fill: '#dc3740',
              stroke: '#dc3740',
              strokeWidth: 2,
              rotation: el.rotation || 0,
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

          <!-- Notes labels for all elements -->
          <template v-for="el in elementsWithNotes" :key="'note-' + el.id">
            <v-label
              :config="{
                x: el._noteX,
                y: el._noteY,
                listening: false,
                visible: !isElementDragging || el.id !== draggingElementId,
              }"
            >
              <v-tag :config="{ fill: 'rgba(30,30,30,0.75)', cornerRadius: 3, pointerDirection: 'up', pointerWidth: 6, pointerHeight: 5 }" />
              <v-text :config="{ text: el.notes, fontSize: 11, fill: '#e5e7eb', padding: 6, fontFamily: 'sans-serif', listening: false }" />
            </v-label>
          </template>

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
              dash: [2, 3],
              listening: false,
            }"
          />


        </v-layer>
      </v-stage>

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

      <!-- Floating Properties Panel (single selection) -->
      <transition name="fade-panel">
        <div
          v-if="selectedIds.size === 1 && selectedElement && floatingPanelPos && !isElementDragging"
          class="absolute z-40 w-64 bg-popover border border-border rounded-lg shadow-xl flex flex-col gap-4.5 p-6 text-sm"
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
              <div v-if="channelInfo.color" class="flex items-center gap-1.5 mt-1">
                <div :style="{ backgroundColor: channelInfo.color }" class="w-3 h-3 rounded-sm border border-border shrink-0"></div>
                <span>{{ channelInfo.color }}</span>
              </div>
            </div>
            <div class="flex gap-1">
              <Button variant="outline" size="sm" class="h-7 text-xs flex-1" @click="jumpToChannel">→ Zum Kanal</Button>
              <Button variant="outline" size="sm" class="h-7 text-xs flex-1" @click="openReassignPicker">Kanal ändern</Button>
            </div>
          </template>

          <!-- Notizen (alle Typen) -->
          <div class="space-y-1">
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

      <!-- Floating multi-select panel -->
      <transition name="fade-panel">
        <div
          v-if="selectedIds.size > 1"
          class="absolute z-40 bottom-14 left-1/2 -translate-x-1/2 bg-popover border border-border rounded-lg shadow-xl flex items-center gap-3 px-4 py-2 text-sm"
          @mousedown.stop
        >
          <span class="text-muted-foreground text-xs">{{ selectedIds.size }} Elemente ausgewählt</span>
          <Button variant="destructive" size="sm" class="h-7 text-xs" @click="deleteSelected">
            <Trash2 class="size-3 mr-1" />Löschen
          </Button>
        </div>
      </transition>
    </div>


    <!-- Top bar options -->
    <div class="absolute top-2 left-[60px] z-20 flex items-center gap-2 bg-background/80 backdrop-blur border border-border rounded p-1">
      <Button
        size="sm"
        :variant="showGrid ? 'default' : 'ghost'"
        @click="showGrid = !showGrid"
        class="h-7 px-2 text-xs"
        title="Gitter anzeigen (G)"
      >Gitter</Button>
      <Button
        size="sm"
        :variant="snapToGrid ? 'default' : 'ghost'"
        @click="snapToGrid = !snapToGrid"
        class="h-7 px-2 text-xs"
        title="Am Gitter einrasten"
      >Einrasten</Button>
    </div>

    <!-- Reassign Channel Dialog -->
    <Dialog :open="!!reassignTargetId" @update:open="val => { if (!val) reassignTargetId = null }">
      <DialogContent class="w-72 max-h-[28rem] flex flex-col gap-0 p-4">
        <DialogHeader class="mb-3">
          <DialogTitle class="text-sm">Kanal neu zuweisen</DialogTitle>
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
            @click="reassignChannel(ch)"
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
          <Button variant="outline" @click="reassignTargetId = null" class="w-full">Abbrechen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

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
import {
  Copy,
  MousePointer2, Hand, Minus, Square, Circle, Type, CircleDot,
  Upload, ImageOff, Download, Undo2, Redo2, Trash2
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'

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
const reassignTargetId = ref(null)
const stageRef = ref(null)
const elementsLayerRef = ref(null)
const transformerRef = ref(null)
const containerEl = ref(null)

const imageUploadInput = ref(null)
const history = ref([])
const historyIndex = ref(-1)
const lassoRect = ref(null)
const pendingDirectionId = ref(null)

const bgImage = ref(null)
const stageSize = ref({ width: 1200, height: 800 })
const showGrid = ref(false)
const snapToGrid = ref(false)
const GRID_SIZE = 30
const panOffset = ref({ x: 0, y: 0 })
const isPanning = ref(false)
const panStart = ref(null)
const spaceHeld = ref(false)
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
  scaleX: 1,
  scaleY: 1,
  x: panOffset.value.x,
  y: panOffset.value.y,
}))

const bgImageRect = computed(() => {
  if (!bgImage.value) return { x: 0, y: 0, width: 0, height: 0 }

  const cw = stageSize.value.width
  const ch = stageSize.value.height
  const iw = bgImage.value.naturalWidth || 1
  const ih = bgImage.value.naturalHeight || 1
  const scale = Math.max(cw / iw, ch / ih)
  const width = iw * scale
  const height = ih * scale

  return {
    x: (cw - width) / 2,
    y: (ch - height) / 2,
    width,
    height,
  }
})


const selectedId = computed(() => selectedIds.value.size === 1 ? [...selectedIds.value][0] : null)
const selectedElement = computed(() => elements.value.find(e => e.id === selectedId.value))
const usedChannels = computed(() => elements.value.filter(e => e.type === 'channel').map(e => e.channel))
const channelInfo = computed(() => {
  if (!selectedElement.value || selectedElement.value.type !== 'channel') return null
  return props.channels.find(ch => ch.channel === selectedElement.value.channel)
})
const elementsWithNotes = computed(() => {
  return elements.value
    .filter(el => el.notes && el.notes.trim())
    .map(el => {
      let x, y

      if (el.type === 'line') {
        const x1 = el.x1
        const y1 = el.y1
        const x2 = el.x2
        const y2 = el.y2
        const mx = (x1 + x2) / 2
        const my = (y1 + y2) / 2
        const dx = x2 - x1
        const dy = y2 - y1
        const len = Math.hypot(dx, dy) || 1
        const nx = -dy / len
        const ny = dx / len
        x = mx + nx * 12
        y = my + ny * 12
      } else if (el.type === 'rect') {
        const cx = el.x + el.w / 2
        const cy = el.y + el.h / 2
        const angle = ((el.rotation || 0) * Math.PI) / 180
        const offsetX = 0
        const offsetY = el.h / 2 + 12
        const rx = offsetX * Math.cos(angle) - offsetY * Math.sin(angle)
        const ry = offsetX * Math.sin(angle) + offsetY * Math.cos(angle)
        x = cx + rx
        y = cy + ry
      } else if (el.type === 'ellipse') {
        const angle = ((el.rotation || 0) * Math.PI) / 180
        const offsetX = 0
        const offsetY = el.ry + 12
        const rx = offsetX * Math.cos(angle) - offsetY * Math.sin(angle)
        const ry = offsetX * Math.sin(angle) + offsetY * Math.cos(angle)
        x = el.x + rx
        y = el.y + ry
      } else if (el.type === 'channel') {
        x = el.x
        y = el.y + 16
      } else {
        const angle = ((el.rotation || 0) * Math.PI) / 180
        const fontSize = el.fontSize || 16
        const offsetX = 0
        const offsetY = fontSize + 8
        const rx = offsetX * Math.cos(angle) - offsetY * Math.sin(angle)
        const ry = offsetX * Math.sin(angle) + offsetY * Math.cos(angle)
        x = el.x + rx
        y = el.y + ry
      }

      return { ...el, _noteX: x, _noteY: y }
    })
})

const filteredChannels = computed(() => {
  const q = channelSearch.value.toLowerCase()
  return props.channels.filter(ch =>
    ch.channel.toLowerCase().includes(q) ||
    (ch.device && ch.device.toLowerCase().includes(q))
  )
})

const isElementDragging = ref(false)
const draggingElementId = ref(null)
  
// --------------- Floating panel position --------------- 
const floatingPanelPos = computed(() => { 
if (!selectedElement.value) return null 

const el = selectedElement.value 
const px = panOffset.value.x 
const py = panOffset.value.y 

let edgeLeft, edgeRight, edgeTop, edgeBottom 

if (el.type === 'line') { 
const x1s = el.x1 + px 
const x2s = el.x2 + px 
const y1s = el.y1 + py 
const y2s = el.y2 + py 

edgeLeft = Math.min(x1s, x2s) 
edgeRight = Math.max(x1s, x2s) 
edgeTop = Math.min(y1s, y2s) 
edgeBottom = Math.max(y1s, y2s) 
} else if (el.type === 'rect') { 
edgeLeft = el.x + px 
edgeRight = el.x + el.w + px 
edgeTop = el.y + py 
edgeBottom = el.y + el.h + py 
} else if (el.type === 'ellipse') { 
edgeLeft = el.x - el.rx + px 
edgeRight = el.x + el.rx + px 
edgeTop = el.y - el.ry + py 
edgeBottom = el.y + el.ry + py 
} else if (el.type === 'channel') { 
const r = 14 
edgeLeft = el.x + px - r 
edgeRight = el.x + px + r 
edgeTop = el.y + py - r 
edgeBottom = el.y + py + r 
} else { 
const textW = 60 
const textH = el.fontSize || 16 
edgeLeft = el.x + px 
edgeRight = edgeLeft + textW 
edgeTop = el.y + py 
edgeBottom = edgeTop + textH 
}

  const PANEL_W = 256
  const PANEL_H = 340
  const MARGIN = 12
  const GAP = 38

  const containerW = stageSize.value.width
  const containerH = stageSize.value.height

  let left = edgeRight + GAP
  let top = edgeTop - GAP

  if (left + PANEL_W > containerW - MARGIN) {
    left = edgeLeft - PANEL_W - GAP
  }

  if (top < MARGIN) {
    top = edgeBottom + GAP
  }

  if (left < MARGIN) left = MARGIN
  if (top + PANEL_H > containerH - MARGIN) top = containerH - PANEL_H - MARGIN
  if (top < MARGIN) top = MARGIN

  return {
    left: Math.round(left),
    top: Math.round(top),
  }
})

function typeLabel(type) {
  return {
    line: 'Linie',
    rect: 'Rechteck',
    ellipse: 'Ellipse',
    text: 'Text',
    channel: 'Kanal',
  }[type] || type
}

// --------------- Background image ---------------
function fitToContainer() {
  panOffset.value = { x: 0, y: 0 }
}

watch(() => props.imageUrl, (url) => {
  if (!url) { bgImage.value = null; return }
  const img = new Image()
  img.onload = () => {
    bgImage.value = img
    nextTick(fitToContainer)
  }
  img.src = url
}, { immediate: true })

// --------------- Grid (Konva-layer) ---------------
const gridLeft   = computed(() => -panOffset.value.x)
const gridTop    = computed(() => -panOffset.value.y)
const gridRight  = computed(() => gridLeft.value + stageSize.value.width)
const gridBottom = computed(() => gridTop.value  + stageSize.value.height)
const gridVerticalLines = computed(() => {
  const lines = []
  const start = Math.floor(gridLeft.value / GRID_SIZE) * GRID_SIZE
  for (let x = start; x <= gridRight.value; x += GRID_SIZE) lines.push(x)
  return lines
})
const gridHorizontalLines = computed(() => {
  const lines = []
  const start = Math.floor(gridTop.value / GRID_SIZE) * GRID_SIZE
  for (let y = start; y <= gridBottom.value; y += GRID_SIZE) lines.push(y)
  return lines
})

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
  return {
    x: pos.x - panOffset.value.x,
    y: pos.y - panOffset.value.y,
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

  if (activeTool.value === 'pan' || spaceHeld.value) {
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

function onStageMouseMove(_e) {
  if (activeTool.value === 'channel-direction' && pendingDirectionId.value) {
    const el = elements.value.find(e => e.id === pendingDirectionId.value)
    if (el) {
      const pos = getPointerPos()
      el.rotation = Math.atan2(pos.y - el.y, pos.x - el.x) * 180 / Math.PI
    }
    return
  }

  if (isPanning.value) return

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
  if (activeTool.value === 'channel-direction' && pendingDirectionId.value) {
    const el = elements.value.find(e => e.id === pendingDirectionId.value)
    if (el) {
      const pos = getPointerPos()
      const dx = pos.x - el.x
      const dy = pos.y - el.y
      el.rotation = Math.atan2(dy, dx) * 180 / Math.PI
      emitChange()
    }
    pendingDirectionId.value = null
    activeTool.value = 'select'
    return
  }

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


function resetView() { 
if (bgImage.value) { 
fitToContainer() 
} else { 
panOffset.value = { x: 0, y: 0 } 
} 
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
// absPos is in stage canvas pixels (already accounts for zoom & pan) 
const absPos = node.getAbsolutePosition() 
const containerBox = containerEl.value.getBoundingClientRect() 
const stageBox = stage.container().getBoundingClientRect() 
textEditNode.value = el 
textEditValue.value = el.text 
textEditStyle.value = { 
top: (stageBox.top - containerBox.top + absPos.y) + 'px', 
left: (stageBox.left - containerBox.left + absPos.x) + 'px', 
minWidth: '80px', 
fontSize: (el.fontSize || 16) + 'px', 
transform: `rotate(${el.rotation || 0}deg)`, 
transformOrigin: '0 0', 
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
  if (e) e.cancelBubble = true
  const node = e?.target
  if (!node) return
  const origCx = (el.x1 + el.x2) / 2
  const origCy = (el.y1 + el.y2) / 2
  const dx = node.x() - origCx
  const dy = node.y() - origCy
  el.x1 = snap(el.x1 + dx); el.y1 = snap(el.y1 + dy)
  el.x2 = snap(el.x2 + dx); el.y2 = snap(el.y2 + dy)
  const newCx = (el.x1 + el.x2) / 2
  const newCy = (el.y1 + el.y2) / 2
  node.position({ x: newCx, y: newCy })
  node.offsetX(newCx); node.offsetY(newCy)
  draggingElementId.value = null
  isElementDragging.value = false
  emitChange()
}

function onRectDragEnd(el, e) {
  if (e) e.cancelBubble = true
  const node = e?.target
  if (!node) return
  el.x = snap(node.x() - el.w / 2)
  el.y = snap(node.y() - el.h / 2)
  node.position({ x: el.x + el.w / 2, y: el.y + el.h / 2 })
  draggingElementId.value = null
  isElementDragging.value = false
  emitChange()
}

function onSimpleDragEnd(el, e) {
  if (e) e.cancelBubble = true
  const node = e?.target
  if (!node) return
  el.x = snap(node.x()); el.y = snap(node.y())
  draggingElementId.value = null
  isElementDragging.value = false
  emitChange()
}

// --------------- Transform end handlers ---------------
function onLineTransformEnd(el, e) {
  const node = e.target
  const sx = node.scaleX()
  const sy = node.scaleY()
  const rot = node.rotation() * Math.PI / 180
  const nx = node.x()
  const ny = node.y()

  // Transform endpoints from local (offset-adjusted) space to canvas space
  // Original points are relative to the line's internal origin (offset applied)
  const ox = (el.x1 + el.x2) / 2
  const oy = (el.y1 + el.y2) / 2
  // Local coords relative to offset pivot
  const lx1 = el.x1 - ox; const ly1 = el.y1 - oy
  const lx2 = el.x2 - ox; const ly2 = el.y2 - oy

  function transformPt(lx, ly) {
    const scaled = { x: lx * sx, y: ly * sy }
    const rotated = {
      x: scaled.x * Math.cos(rot) - scaled.y * Math.sin(rot),
      y: scaled.x * Math.sin(rot) + scaled.y * Math.cos(rot),
    }
    return { x: rotated.x + nx, y: rotated.y + ny }
  }

  const p1 = transformPt(lx1, ly1)
  const p2 = transformPt(lx2, ly2)
  el.x1 = p1.x; el.y1 = p1.y
  el.x2 = p2.x; el.y2 = p2.y
  el.rotation = 0

  node.scaleX(1); node.scaleY(1)
  node.rotation(0)
  const newCx = (el.x1 + el.x2) / 2
  const newCy = (el.y1 + el.y2) / 2
  node.position({ x: newCx, y: newCy })
  node.offsetX(newCx); node.offsetY(newCy)
  node.points([el.x1, el.y1, el.x2, el.y2])
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
  const id = uuid()
  addElement({ id, type: 'channel', x: channelPickerPos.value.x, y: channelPickerPos.value.y, channel: ch.channel, rotation: 0 })
  showChannelPicker.value = false
  pendingDirectionId.value = id
  activeTool.value = 'channel-direction'
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

function openReassignPicker() {
  if (selectedElement.value?.type === 'channel') {
    reassignTargetId.value = selectedElement.value.id
    channelSearch.value = ''
  }
}

function reassignChannel(ch) {
  const el = elements.value.find(e => e.id === reassignTargetId.value)
  if (el) { el.channel = ch.channel; emitChange() }
  reassignTargetId.value = null
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


// --------------- Keyboard shortcuts ---------------
function isInputFocused() {
  const tag = document.activeElement?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA'
}

function handleKeyDown(e) {
  if (isInputFocused()) return

  if (e.key === ' ') { e.preventDefault(); spaceHeld.value = true; return }

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
    if (e.key === 'Escape') {
      if (activeTool.value === 'channel-direction') {
        pendingDirectionId.value = null
      }
      activeTool.value = 'select'
      selectedIds.value = new Set()
      return
    }
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
    if (e.key === '0') { e.preventDefault(); resetView(); return }
  }
}

// --------------- Global pan handlers (active during pan to prevent losing drag when mouse leaves stage) ---------------
function onWindowMouseMove(e) {
  if (!isPanning.value || !panStart.value) return
  const dx = e.clientX - panStart.value.mx
  const dy = e.clientY - panStart.value.my
  panOffset.value = { x: panStart.value.ox + dx, y: panStart.value.oy + dy }
}

function onWindowMouseUp() {
  if (isPanning.value) {
    isPanning.value = false
    panStart.value = null
  }
}

// --------------- Lifecycle ---------------
let resizeObserver = null

function handleKeyUp(e) {
  if (e.key === ' ') { spaceHeld.value = false }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('mousemove', onWindowMouseMove)
  window.addEventListener('mouseup', onWindowMouseUp)
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
  window.removeEventListener('keyup', handleKeyUp)
  window.removeEventListener('mousemove', onWindowMouseMove)
  window.removeEventListener('mouseup', onWindowMouseUp)
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

.fade-panel-enter-active,
.fade-panel-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.fade-panel-enter-from,
.fade-panel-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
