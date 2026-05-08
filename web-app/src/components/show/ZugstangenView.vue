<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Zugstangen-Liste -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="bars.length === 0" class="flex items-center justify-center h-32 text-sm text-muted-foreground">
        Noch keine Zugstangen
      </div>

      <!-- Eine Zeile pro Zugstange -->
      <div
        v-for="bar in bars"
        :key="bar.id"
        class="flex items-center gap-4 px-5 border-b border-border bg-card h-21.5"
      >
        <!-- Name + Länge -->
        <div class="w-36 shrink-0">
          <div class="text-sm font-bold text-foreground truncate">{{ bar.name }}</div>
          <div class="text-xs text-muted-foreground mt-0.5">{{ bar.length_cm }} cm</div>
        </div>

        <!-- Stangen-Visualisierung -->
        <div class="flex-1 min-w-0 relative" style="height: 61px;">
          <!-- Skala-Labels oben -->
          <div class="absolute top-0 left-0 right-0 h-4">
            <span
              v-for="tick in getScaleTicks(bar)"
              :key="tick.pos"
              class="absolute text-[9px] text-muted-foreground/60 -translate-x-1/2"
              :style="{ left: tick.pct + '%' }"
            >{{ tick.label }}</span>
          </div>

          <!-- Stangen-Linie + Marker -->
          <div
            class="absolute left-0 right-0 h-4 rounded-full bg-muted/60 border border-border cursor-crosshair"
            style="top: 20px;"
            :data-bar-id="bar.id"
            @click.self="onBarLineClick($event, bar)"
          >
            <!-- Kanal-Marker -->
            <div
              v-for="fx in bar.fixtures"
              :key="fx.channel_id"
              class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group/fx z-10"
              :style="{ left: posPercent(fx.position, bar.length_cm) + '%' }"
              @mousedown.prevent.stop="startDrag($event, fx, bar)"
            >
              <button
                class="size-11.5 rounded-full border-2 border-border bg-background flex items-center justify-center hover:border-accent transition-colors shadow-sm"
                style="margin-top: -15px;"
                @click.stop="goToChannel(fx.channel_id)"
              >
                <span class="text-sm font-bold text-accent">{{ channelNr(fx.channel_id) }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Aktionen -->
        <div class="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" class="text-xs text-muted-foreground" @click="openEditBarDialog(bar)">
            <Pencil class="size-3 mr-1" />Bearbeiten
          </Button>
          <Button variant="ghost" size="sm" class="text-xs text-red-400 hover:text-red-500 hover:bg-red-500/10" @click="confirmDeleteBar(bar)">
            <Trash2 class="size-3 mr-1" />Löschen
          </Button>
        </div>
      </div>
    </div>

    <!-- Neue Zugstange -->
    <div class="shrink-0 border-t border-border px-5 py-3 flex justify-end">
      <Button variant="ghost" size="sm" class="text-xs text-muted-foreground border border-dashed border-border/60" @click="openNewBarDialog">
        <Plus class="size-3 mr-1.5" /> Neue Zugstange
      </Button>
    </div>
  </div>

  <!-- Bar Dialog -->
  <Dialog :open="barDialogOpen" @update:open="barDialogOpen = $event">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ editingBar ? 'Zugstange bearbeiten' : 'Neue Zugstange' }}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-muted-foreground">Name</label>
          <Input v-model="barForm.name" placeholder="z. B. Maschinenzug 1" autofocus />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-muted-foreground">Länge (cm)</label>
          <Input v-model.number="barForm.length_cm" type="number" min="50" max="3000" />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" @click="barDialogOpen = false">Abbrechen</Button>
        <Button @click="saveBarForm">{{ editingBar ? 'Speichern' : 'Anlegen' }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Fixture Picker -->
  <Dialog :open="fixturePickerOpen" @update:open="fixturePickerOpen = $event">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Scheinwerfer hinzufügen</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <Input v-model="fixtureSearch" placeholder="Kanal suchen…" autofocus />
        <div class="max-h-48 overflow-y-auto flex flex-col gap-1">
          <button
            v-for="ch in filteredChannelsForPicker"
            :key="ch.channel"
            class="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/60 text-left transition-colors"
            @click="pickerChannel = ch; fixtureSearch = ''"
          >
            <span :class="pickerChannel?.id === ch.id ? 'text-accent font-bold' : ''" class="font-mono text-base w-10">{{ ch.channel }}</span>
            <span class="text-xs text-muted-foreground truncate">{{ ch.device }}</span>
          </button>
        </div>
        <div v-if="pickerChannel" class="flex flex-col gap-1.5 border-t border-border pt-3">
          <label class="text-xs text-muted-foreground">Position auf Stange (cm, 0 = Mitte)</label>
          <Input v-model.number="pickerPosition" type="number" :min="-(pickerBar?.length_cm || 600)/2" :max="(pickerBar?.length_cm || 600)/2" />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" @click="fixturePickerOpen = false">Abbrechen</Button>
        <Button :disabled="!pickerChannel" @click="confirmAddFixture">Hinzufügen</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { Plus, Pencil, Trash2 } from 'lucide-vue-next'
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
})

const emit = defineEmits(['assigned', 'navigate-to-channel'])

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
  const step = len <= 300 ? 50 : len <= 600 ? 100 : 200
  const ticks = []
  for (let cm = -half; cm <= half; cm += step) {
    ticks.push({ pos: cm, pct: posPercent(cm, len), label: cm === 0 ? '0' : `${cm}` })
  }
  return ticks
}

function goToChannel(channelId) {
  emit('navigate-to-channel', channelId)
}

// Bar Dialog
const barDialogOpen = ref(false)
const editingBar = ref(null)
const barForm = ref({ name: '', zug_nr: '', length_cm: 1000 })

function openNewBarDialog() {
  editingBar.value = null
  barForm.value = { name: '', zug_nr: '', length_cm: 1000 }
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
    await props.saveBarFn(editingBar.value.id, { ...barForm.value })
  } else {
    await props.addBarFn({ ...barForm.value })
  }
  barDialogOpen.value = false
}
function confirmDeleteBar(bar) {
  if (confirm(`Zugstange "${bar.name}" wirklich löschen?`)) {
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
