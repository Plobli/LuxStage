<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Zugstangen-Liste -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="bars.length === 0" class="flex items-center justify-center h-32 text-sm text-muted-foreground">
        {{ t('zugstange.empty') }}
      </div>

      <!-- Eine Zeile pro Zugstange -->
      <div
        v-for="bar in bars"
        :key="bar.id"
        draggable="true"
        class="group/row flex flex-col px-6 pt-4 pb-3 border-b border-border/50 hover:bg-white/2 transition-colors"
        :class="dragOverId === bar.id ? 'bg-white/5 border-l-2 border-l-primary' : draggedId === bar.id ? 'opacity-40' : ''"
        @dragstart="onBarDragStart(bar.id)"
        @dragover="onBarDragOver($event, bar.id)"
        @drop="onBarDrop(bar.id)"
        @dragend="onBarDragEnd"
      >
        <!-- Obere Zeile: Name + Visualisierung + Aktionen -->
        <div class="flex items-center gap-6">
          <!-- Drag Handle + Name + Länge -->
          <div class="w-40 shrink-0 flex items-start gap-2">
            <svg class="size-4 text-muted-foreground/40 mt-0.5 shrink-0 cursor-grab" viewBox="0 0 16 16" fill="currentColor"><circle cx="5.5" cy="4" r="1.2"/><circle cx="10.5" cy="4" r="1.2"/><circle cx="5.5" cy="8" r="1.2"/><circle cx="10.5" cy="8" r="1.2"/><circle cx="5.5" cy="12" r="1.2"/><circle cx="10.5" cy="12" r="1.2"/></svg>
          <div class="min-w-0">
            <div class="text-sm font-semibold text-foreground tracking-tight truncate">{{ bar.name }}</div>
            <div class="text-xs text-muted-foreground/60 mt-0.5 tabular-nums">{{ formatLength(bar.length_cm) }}</div>
          </div>
          </div>

          <!-- Stangen-Visualisierung -->
          <div class="flex-1 min-w-0 relative" style="height: 72px;">
            <!-- Skala-Labels oben -->
            <div class="absolute left-0 right-0 h-4" style="top: 24px;">
              <span
                v-for="tick in getScaleTicks(bar)"
                :key="tick.pos"
                class="absolute text-[9px] -translate-x-1/2 tabular-nums leading-none"
                :class="tick.center ? 'text-foreground font-semibold' : 'text-muted-foreground'"
                :style="{ left: tick.pct + '%' }"
              >{{ tick.label }}</span>
            </div>

            <!-- Stangen-Linie + Marker -->
            <div
              class="absolute left-0 right-0 cursor-crosshair"
              style="top: 42px; height: 6px;"
              :data-bar-id="bar.id"
              @click.self="onBarLineClick($event, bar)"
            >
              <!-- Stangen-Track -->
              <div class="absolute inset-0 rounded-full bg-white/25 border border-white/40 pointer-events-none" />
              <!-- Tick-Striche -->
              <div
                v-for="tick in getScaleTicks(bar)"
                :key="'t'+tick.pos"
                class="absolute top-1/2 -translate-x-px pointer-events-none"
                :style="{
                  left: tick.pct + '%',
                  height: tick.center ? '16px' : '10px',
                  marginTop: tick.center ? '-8px' : '-5px',
                  width: tick.center ? '2px' : '1px',
                  background: tick.center ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)',
                }"
              />
              <!-- Kanal-Marker -->
              <div
                v-for="fx in bar.fixtures"
                :key="fx.channel_id"
                class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group/fx z-10"
                :style="{ left: posPercent(fx.position, bar.length_cm) + '%' }"
                @mousedown.prevent.stop="startDrag($event, fx, bar)"
              >
                <button
                  class="size-10 rounded-full border-2 border-accent bg-accent/30 backdrop-blur-sm flex items-center justify-center hover:bg-accent/50 transition-all shadow-lg"
                  @click.stop="goToChannel(fx.channel_id)"
                >
                  <span class="text-xs font-bold text-white tabular-nums drop-shadow-sm">{{ channelNr(fx.channel_id) }}</span>
                </button>
                <button
                  class="absolute -top-0.5 -right-0.5 size-3.5 rounded-full bg-red-500/90 text-white items-center justify-center hidden group-hover/fx:flex z-20 hover:bg-red-500 transition-colors shadow"
                  @click.stop="confirmRemoveFixture(fx, bar)"
                ><svg viewBox="0 0 10 10" width="7" height="7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="2" y1="2" x2="8" y2="8"/><line x1="8" y1="2" x2="2" y2="8"/></svg></button>
              </div>
            </div>
          </div>

          <!-- Aktionen (nur bei Hover) -->
          <div class="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" class="size-7 text-muted-foreground/60 hover:text-foreground" @click="openEditBarDialog(bar)">
              <Pencil class="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" class="size-7 text-muted-foreground/60 hover:text-red-400" @click="confirmDeleteBar(bar)">
              <Trash2 class="size-3.5" />
            </Button>
          </div>
        </div>

        <!-- Höhe + Anmerkungen -->
        <div class="flex items-center gap-4 mt-2 ml-46">
          <div class="relative w-32">
            <input
              type="text"
              inputmode="decimal"
              :value="bar.height_cm != null ? cmToDisplay(bar.height_cm) : ''"
              placeholder="Höhe"
              class="w-full h-9 rounded-md border border-border/60 bg-transparent px-3 pr-7 text-sm tabular-nums text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent"
              @change="saveInlineField(bar, 'height_cm', $event.target.value === '' ? null : parseToCm(Number($event.target.value)))"
            />
            <span class="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/50 pointer-events-none">{{ unit }}</span>
          </div>
          <input
            type="text"
            :value="bar.notes ?? ''"
            placeholder="Anmerkung…"
            class="flex-1 h-9 rounded-md border border-border/60 bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent"
            @change="saveInlineField(bar, 'notes', $event.target.value)"
          />
        </div>
      </div>
    </div>

    <!-- Neue Zugstange -->
    <div class="shrink-0 border-t border-border px-5 py-3 flex justify-end">
      <Button variant="ghost" size="sm" class="text-xs text-muted-foreground border border-dashed border-border/60" @click="openNewBarDialog">
        <Plus class="size-3 mr-1.5" /> {{ t('zugstange.new') }}
      </Button>
    </div>
  </div>

  <!-- Bar Dialog -->
  <Dialog :open="barDialogOpen" @update:open="barDialogOpen = $event">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ editingBar ? t('zugstange.dialog.edit') : t('zugstange.dialog.new') }}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-muted-foreground">{{ t('zugstange.field.name') }}</label>
          <Input size="lg" v-model="barForm.name" placeholder="z. B. Maschinenzug 1" autofocus />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-muted-foreground">{{ t('zugstange.field.length') }} ({{ unit }})</label>
          <Input size="lg" v-model.number="barFormDisplay.length" type="number" :min="lengthMin" :max="lengthMax" :step="inputStep" />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" @click="barDialogOpen = false">{{ t('action.cancel') }}</Button>
        <Button @click="saveBarForm">{{ editingBar ? t('action.save') : t('zugstange.action.create') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Fixture Picker -->
  <Dialog :open="fixturePickerOpen" @update:open="fixturePickerOpen = $event">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ t('zugstange.fixture.add') }}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <Input size="lg" v-model="fixtureSearch" placeholder="Kanal suchen…" autofocus @keydown.enter="selectFirstAndConfirm" />
        <div class="max-h-48 overflow-y-auto flex flex-col gap-1">
          <button
            v-for="(ch, idx) in filteredChannelsForPicker"
            :key="ch.channel"
            class="flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors"
            :class="idx === 0 ? 'bg-muted/60' : 'hover:bg-muted/60'"
            @click="pickerChannel = ch; fixtureSearch = ''"
          >
            <span :class="pickerChannel?.id === ch.id ? 'text-accent font-bold' : ''" class="font-mono text-base w-10">{{ ch.channel }}</span>
            <span class="text-xs text-muted-foreground truncate">{{ ch.device }}</span>
          </button>
        </div>
        <div v-if="pickerChannel" class="flex flex-col gap-1.5 border-t border-border pt-3">
          <label class="text-xs text-muted-foreground">{{ t('zugstange.fixture.position') }} ({{ unit }})</label>
          <Input size="lg" :modelValue="cmToDisplay(pickerPosition)" type="number" :min="cmToDisplay(-(pickerBar?.length_cm || 600)/2)" :max="cmToDisplay((pickerBar?.length_cm || 600)/2)" :step="inputStep" @update:modelValue="pickerPosition = parseToCm(Number($event))" />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" @click="fixturePickerOpen = false">{{ t('action.cancel') }}</Button>
        <Button :disabled="!pickerChannel" @click="confirmAddFixture">{{ t('action.add') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { useLocale } from '@/composables/useLocale.js'
import { useMeasureUnit } from '@/composables/useMeasureUnit'
const { t } = useLocale()
const { unit, formatLength, cmToDisplay, parseToCm, inputStep, lengthMin, lengthMax } = useMeasureUnit()
import { Plus, Pencil, Trash2 } from 'lucide-vue-next'
import { useDragReorder } from '@/composables/useDragReorder'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'

const props = defineProps({
  bars: { type: Array, required: true },
  channels: { type: Array, required: true },
  preselectedChannelId: { type: String, default: null },
  addBarFn: { type: Function, required: true },
  saveBarFn: { type: Function, required: true },
  deleteBarFn: { type: Function, required: true },
  assignFixtureFn: { type: Function, required: true },
  unassignFixtureFn: { type: Function, required: true },
  reorderBarsFn: { type: Function, default: null },
})

const emit = defineEmits(['assigned', 'navigate-to-channel', 'reordered'])

// Drag & Drop — arbeitet auf einer lokalen Kopie, Prop-Array bleibt readonly
const localBars = computed(() => props.bars)
const draggedId = ref(null)
const dragOverId = ref(null)

function onBarDragStart(id) { draggedId.value = id }
function onBarDragOver(e, id) { e.preventDefault(); dragOverId.value = id }
function onBarDrop(targetId) {
  const arr = [...localBars.value]
  const from = arr.findIndex(b => b.id === draggedId.value)
  const to = arr.findIndex(b => b.id === targetId)
  if (from === -1 || to === -1 || from === to) { draggedId.value = null; dragOverId.value = null; return }
  const [moved] = arr.splice(from, 1)
  arr.splice(to, 0, moved)
  if (props.reorderBarsFn) props.reorderBarsFn(arr.map(b => b.id))
  emit('reordered', arr)
  draggedId.value = null; dragOverId.value = null
}
function onBarDragEnd() { draggedId.value = null; dragOverId.value = null }

const channelById = computed(() => {
  const map = new Map()
  for (const ch of props.channels) map.set(ch.id, ch)
  return map
})
function channelForId(id) { return channelById.value.get(id) ?? null }
function channelNr(id) { return channelForId(id)?.channel ?? '?' }

function posPercent(pos, lengthCm) {
  const len = lengthCm || 600
  return Math.max(0, Math.min(100, ((pos + len / 2) / len) * 100))
}

function getScaleTicks(bar) {
  const len = bar.length_cm || 600
  const half = len / 2
  const labelStep = 50
  const ticks = []
  for (let cm = -half; cm <= half + 0.01; cm += 50) {
    const snapped = Math.round(cm)
    const isCenter = snapped === 0
    const hasLabel = Math.abs(snapped % labelStep) < 0.5
    const displayVal = cmToDisplay(snapped)
    ticks.push({
      pos: snapped,
      pct: posPercent(snapped, len),
      center: isCenter,
      label: hasLabel ? (isCenter ? '0' : `${displayVal}`) : null,
    })
  }
  return ticks
}

function goToChannel(channelId) {
  emit('navigate-to-channel', channelId)
}

// Bar Dialog
const barDialogOpen = ref(false)
const editingBar = ref(null)
const barForm = ref({ name: '', zug_nr: '', length_cm: 1100 })
// Anzeige-Wert für length-Input (in gewählter Einheit)
const barFormDisplay = computed({
  get: () => ({ length: cmToDisplay(barForm.value.length_cm) }),
  set: (v) => { barForm.value.length_cm = parseToCm(v.length) },
})

function openNewBarDialog() {
  editingBar.value = null
  barForm.value = { name: '', zug_nr: '', length_cm: 1100 }
  barDialogOpen.value = true
}
function openEditBarDialog(bar) {
  editingBar.value = bar
  barForm.value = { name: bar.name, zug_nr: bar.zug_nr, length_cm: bar.length_cm }
  barDialogOpen.value = true
}
async function saveBarForm() {
  if (!barForm.value.name) return
  if (editingBar.value) {
    await props.saveBarFn(editingBar.value.id, { ...barForm.value, height_cm: editingBar.value.height_cm ?? null, notes: editingBar.value.notes ?? '' })
  } else {
    await props.addBarFn({ ...barForm.value })
  }
  barDialogOpen.value = false
}
function confirmRemoveFixture(fx, bar) {
  const nr = channelNr(fx.channel_id)
  const fixture = nr !== '?' ? `Kanal ${nr}` : fx.channel_id
  if (confirm(t('zugstange.fixture.remove.confirm', { fixture, bar: bar.name }))) {
    props.unassignFixtureFn(bar.id, fx.channel_id)
  }
}

async function saveInlineField(bar, field, value) {
  await props.saveBarFn(bar.id, { name: bar.name, zug_nr: bar.zug_nr, length_cm: bar.length_cm, height_cm: bar.height_cm, notes: bar.notes, [field]: value })
  bar[field] = value
}

function confirmDeleteBar(bar) {
  if (confirm(t('zugstange.delete.confirm', { name: bar.name }))) {
    props.deleteBarFn(bar.id)
  }
}

// Fixture Picker
const fixturePickerOpen = ref(false)
const fixtureSearch = ref('')
const pickerChannel = ref(null)
const pickerPosition = ref(0)
const pickerBar = ref(null)

const alreadyOnPickerBar = computed(() => new Set((pickerBar.value?.fixtures ?? []).map(f => f.channel_id)))
const filteredChannelsForPicker = computed(() => {
  const q = fixtureSearch.value.trim().toLowerCase()
  return props.channels.filter(ch => {
    if (alreadyOnPickerBar.value.has(ch.id)) return false
    if (!q) return true
    return (ch.channel ?? '').toLowerCase().includes(q) || (ch.device ?? '').toLowerCase().includes(q)
  }).slice(0, 50)
})

function onBarLineClick(event, bar) {
  // Klickposition in cm umrechnen
  const rect = event.currentTarget.getBoundingClientRect()
  const pct = (event.clientX - rect.left) / rect.width
  const len = bar.length_cm || 600
  const rawCm = pct * len - len / 2
  const snapped = Math.round(rawCm / 10) * 10

  pickerBar.value = bar
  pickerChannel.value = null
  pickerPosition.value = Math.max(-len / 2, Math.min(len / 2, snapped))
  fixtureSearch.value = ''
  fixturePickerOpen.value = true
}

function selectFirstAndConfirm() {
  const first = filteredChannelsForPicker.value[0]
  if (first) pickerChannel.value = first
  confirmAddFixture()
}

async function confirmAddFixture() {
  if (!pickerChannel.value || !pickerBar.value) return
  await props.assignFixtureFn(pickerBar.value.id, pickerChannel.value.id, pickerPosition.value)
  fixturePickerOpen.value = false
  pickerChannel.value = null
  emit('assigned')
}

// Drag
let dragging = null
let dragBarLineEl = null

function startDrag(e, fx, bar) {
  // Stangen-Element ermitteln
  const barEl = e.currentTarget.closest('[data-bar-id]')
  dragBarLineEl = barEl
  dragging = { fx, bar, startX: e.clientX, startPos: fx.position }
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', onDragEnd)
}

function onDragMove(e) {
  if (!dragging || !dragBarLineEl) return
  const len = dragging.bar.length_cm
  const rect = dragBarLineEl.getBoundingClientRect()
  const dx = e.clientX - dragging.startX
  const cmPerPx = len / rect.width
  const raw = dragging.startPos + dx * cmPerPx
  const snapped = Math.round(raw / 10) * 10
  const half = len / 2
  dragging.fx.position = Math.max(-half, Math.min(half, snapped))
}

async function onDragEnd() {
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragEnd)
  if (!dragging) return
  const { fx, bar } = dragging
  dragging = null
  dragBarLineEl = null
  await props.assignFixtureFn(bar.id, fx.channel_id, fx.position)
}

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragEnd)
})
</script>
