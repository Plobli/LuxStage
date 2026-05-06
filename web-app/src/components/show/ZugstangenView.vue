<template>
  <div class="flex h-full overflow-hidden">
    <!-- Linke Spalte: Bar-Liste -->
    <div class="w-64 shrink-0 border-r border-border flex flex-col bg-muted/20">
      <div class="flex items-center justify-between px-4 py-3 border-b border-border">
        <span class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Zugstangen</span>
        <Button variant="ghost" size="icon" class="size-7 text-muted-foreground hover:text-foreground" @click="openNewBarDialog">
          <Plus class="size-4" />
        </Button>
      </div>

      <div class="flex-1 overflow-y-auto">
        <div v-if="bars.length === 0" class="px-4 py-8 text-center text-xs text-muted-foreground">
          Noch keine Zugstangen
        </div>
        <button
          v-for="bar in bars"
          :key="bar.id"
          :class="[
            'w-full text-left px-4 py-3 border-b border-border/50 transition-colors hover:bg-muted/40',
            selectedBarId === bar.id ? 'bg-accent/10 border-l-2 border-l-accent' : ''
          ]"
          @click="selectedBarId = bar.id"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-medium text-foreground truncate">{{ bar.name }}</span>
            <span v-if="bar.zug_nr" class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{{ bar.zug_nr }}</span>
          </div>
          <div class="text-[10px] text-muted-foreground mt-0.5">
            {{ bar.fixtures.length }} Scheinwerfer · {{ bar.length_cm }} cm
          </div>
        </button>
      </div>
    </div>

    <!-- Rechte Seite: Balkenplan -->
    <div class="flex-1 min-w-0 flex flex-col">
      <div v-if="!selectedBar" class="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Zugstange auswählen
      </div>

      <template v-else>
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-3 border-b border-border bg-card shrink-0">
          <div>
            <h2 class="text-sm font-semibold text-foreground">{{ selectedBar.name }}</h2>
            <p class="text-xs text-muted-foreground">Zug {{ selectedBar.zug_nr || '–' }} · {{ selectedBar.length_cm }} cm</p>
          </div>
          <div class="flex items-center gap-2">
            <Button variant="ghost" size="sm" class="text-xs text-muted-foreground" @click="openEditBarDialog(selectedBar)">
              <Pencil class="size-3 mr-1" />Bearbeiten
            </Button>
            <Button variant="ghost" size="sm" class="text-xs text-red-400 hover:text-red-500 hover:bg-red-500/10" @click="confirmDeleteBar(selectedBar)">
              <Trash2 class="size-3 mr-1" />Löschen
            </Button>
          </div>
        </div>

        <!-- Balkenplan -->
        <div class="flex-1 overflow-auto p-6">
          <!-- Horizontale Stange -->
          <div class="relative mb-8 select-none" style="min-width: 400px;">
            <!-- Stangen-Linie -->
            <div class="h-4 rounded-full bg-muted/60 border border-border relative">
              <!-- Scheinwerfer-Marker auf der Stange -->
              <div
                v-for="fx in sortedFixtures"
                :key="fx.channel_id"
                class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group/fx"
                :style="{ left: posPercent(fx.position) + '%' }"
              >
                <div
                  class="size-5 rounded-full border-2 border-accent bg-accent/20 flex items-center justify-center cursor-pointer hover:bg-accent/40 transition-colors"
                  :title="channelLabel(fx.channel_id)"
                  @click="editingFixture = fx"
                >
                  <span class="text-[8px] font-bold text-accent">{{ channelNr(fx.channel_id) }}</span>
                </div>
              </div>
            </div>

            <!-- Skala unten -->
            <div class="relative mt-1 h-4">
              <span
                v-for="tick in scaleTicks"
                :key="tick.pos"
                class="absolute text-[9px] text-muted-foreground/60 -translate-x-1/2"
                :style="{ left: tick.pct + '%' }"
              >{{ tick.label }}</span>
            </div>
          </div>

          <!-- Fixture-Liste -->
          <div class="space-y-1 max-w-lg">
            <div class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2 px-1">
              Scheinwerfer auf dieser Zugstange
            </div>
            <div
              v-for="fx in sortedFixtures"
              :key="fx.channel_id"
              class="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-2.5"
            >
              <span class="font-mono text-sm font-semibold w-10 text-foreground">{{ channelNr(fx.channel_id) }}</span>
              <span v-if="channelForId(fx.channel_id)?.color" class="text-xs text-muted-foreground w-24 truncate">{{ channelForId(fx.channel_id)?.color }}</span>
              <span class="flex-1 text-xs text-muted-foreground truncate">{{ channelForId(fx.channel_id)?.device }}</span>
              <span class="text-[10px] text-muted-foreground/60 w-14 text-right tabular-nums">{{ fx.position }} cm</span>
              <div class="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" class="size-6 text-muted-foreground hover:text-foreground" @click="editingFixture = fx">
                  <Pencil class="size-3" />
                </Button>
                <Button variant="ghost" size="icon" class="size-6 text-muted-foreground hover:text-red-400" @click="removeFixture(selectedBar.id, fx.channel_id)">
                  <X class="size-3" />
                </Button>
              </div>
            </div>

            <Button variant="ghost" size="sm" class="w-full text-xs text-muted-foreground mt-2 border border-dashed border-border/60" @click="openFixturePicker">
              <Plus class="size-3 mr-1.5" /> Scheinwerfer hinzufügen
            </Button>
          </div>
        </div>
      </template>
    </div>
  </div>

  <!-- Bar Dialog -->
  <Dialog :open="barDialogOpen" @update:open="barDialogOpen = $event">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ editingBar ? 'Zugstange bearbeiten' : 'Neue Zugstange' }}</DialogTitle>
      </DialogHeader>
      <div class="flex flex-col gap-4 py-2">
        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-muted-foreground">Name</label>
          <Input v-model="barForm.name" placeholder="z. B. Bühnenportal" autofocus />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-muted-foreground">Zugnummer</label>
            <Input v-model="barForm.zug_nr" placeholder="z. B. 12" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-muted-foreground">Länge (cm)</label>
            <Input v-model.number="barForm.length_cm" type="number" min="50" max="3000" />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" @click="barDialogOpen = false">Abbrechen</Button>
        <Button @click="saveBarForm">{{ editingBar ? 'Speichern' : 'Anlegen' }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Fixture Picker (Kanal + Position) -->
  <Dialog :open="fixturePickerOpen" @update:open="fixturePickerOpen = $event">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Scheinwerfer hinzufügen</DialogTitle>
      </DialogHeader>
      <div class="flex flex-col gap-3 py-2">
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
          <label class="text-xs text-muted-foreground">Position auf Stange (cm)</label>
          <Input v-model.number="pickerPosition" type="number" min="0" :max="selectedBar?.length_cm || 600" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" @click="fixturePickerOpen = false">Abbrechen</Button>
        <Button :disabled="!pickerChannel" @click="confirmAddFixture">Hinzufügen</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Fixture Position bearbeiten -->
  <Dialog :open="!!editingFixture" @update:open="val => { if (!val) editingFixture = null }">
    <DialogContent class="sm:max-w-xs">
      <DialogHeader>
        <DialogTitle>Position bearbeiten — Kanal {{ editingFixture ? channelNr(editingFixture.channel_id) : '' }}</DialogTitle>
      </DialogHeader>
      <div class="py-2">
        <label class="text-xs text-muted-foreground">Position (cm)</label>
        <Input v-if="editingFixture" v-model.number="editingFixture.position" type="number" min="0" :max="selectedBar?.length_cm || 600" class="mt-1.5" />
      </div>
      <DialogFooter>
        <Button variant="ghost" @click="editingFixture = null">Abbrechen</Button>
        <Button @click="saveFixturePosition">Speichern</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Plus, Pencil, Trash2, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

const props = defineProps({
  bars: { type: Array, required: true },
  channels: { type: Array, required: true },
  addBarFn: { type: Function, required: true },
  saveBarFn: { type: Function, required: true },
  deleteBarFn: { type: Function, required: true },
  assignFixtureFn: { type: Function, required: true },
  unassignFixtureFn: { type: Function, required: true },
})

const selectedBarId = ref(null)
const selectedBar = computed(() => props.bars.find(b => b.id === selectedBarId.value) ?? null)
const sortedFixtures = computed(() => {
  if (!selectedBar.value) return []
  return [...(selectedBar.value.fixtures ?? [])].sort((a, b) => a.position - b.position)
})

const channelById = computed(() => {
  const map = new Map()
  for (const ch of props.channels) map.set(ch.id, ch)
  return map
})
function channelForId(id) { return channelById.value.get(id) ?? null }
function channelNr(id) { return channelForId(id)?.channel ?? '?' }
function channelLabel(id) {
  const ch = channelForId(id)
  return ch ? `Kanal ${ch.channel}${ch.device ? ' · ' + ch.device : ''}` : id
}

function posPercent(pos) {
  const len = selectedBar.value?.length_cm || 600
  return Math.max(0, Math.min(100, (pos / len) * 100))
}

const scaleTicks = computed(() => {
  const len = selectedBar.value?.length_cm || 600
  const step = len <= 300 ? 50 : len <= 600 ? 100 : 200
  const ticks = []
  for (let cm = 0; cm <= len; cm += step) {
    ticks.push({ pos: cm, pct: posPercent(cm), label: cm === 0 ? '0' : `${cm}` })
  }
  return ticks
})

// Bar Dialog
const barDialogOpen = ref(false)
const editingBar = ref(null)
const barForm = ref({ name: '', zug_nr: '', length_cm: 600 })

function openNewBarDialog() {
  editingBar.value = null
  barForm.value = { name: '', zug_nr: '', length_cm: 600 }
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
    const id = await props.addBarFn({ ...barForm.value })
    selectedBarId.value = id
  }
  barDialogOpen.value = false
}
function confirmDeleteBar(bar) {
  if (confirm(`Zugstange "${bar.name}" wirklich löschen?`)) {
    props.deleteBarFn(bar.id)
    if (selectedBarId.value === bar.id) selectedBarId.value = null
  }
}

// Fixture Picker
const fixturePickerOpen = ref(false)
const fixtureSearch = ref('')
const pickerChannel = ref(null)
const pickerPosition = ref(0)

const alreadyOnBar = computed(() => new Set((selectedBar.value?.fixtures ?? []).map(f => f.channel_id)))
const filteredChannelsForPicker = computed(() => {
  const q = fixtureSearch.value.trim().toLowerCase()
  return props.channels.filter(ch => {
    if (alreadyOnBar.value.has(ch.id)) return false
    if (!q) return true
    return (ch.channel ?? '').toLowerCase().includes(q) || (ch.device ?? '').toLowerCase().includes(q)
  }).slice(0, 50)
})

function openFixturePicker() {
  pickerChannel.value = null
  pickerPosition.value = 0
  fixtureSearch.value = ''
  fixturePickerOpen.value = true
}
async function confirmAddFixture() {
  if (!pickerChannel.value || !selectedBar.value) return
  await props.assignFixtureFn(selectedBar.value.id, pickerChannel.value.id, pickerPosition.value)
  fixturePickerOpen.value = false
  pickerChannel.value = null
}
async function removeFixture(barId, channelId) {
  await props.unassignFixtureFn(barId, channelId)
}

// Edit Position
const editingFixture = ref(null)
async function saveFixturePosition() {
  if (!editingFixture.value || !selectedBar.value) return
  await props.assignFixtureFn(selectedBar.value.id, editingFixture.value.channel_id, editingFixture.value.position)
  editingFixture.value = null
}
</script>
