<template>
  <div class="flex h-full overflow-hidden">
    <!-- Linke Spalte: Tower-Liste -->
    <div class="w-64 shrink-0 border-r border-border flex flex-col bg-muted/20">
      <div class="flex items-center justify-between px-4 py-3 border-b border-border">
        <span class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Gassentürme</span>
        <Button variant="ghost" size="icon" class="size-7 text-muted-foreground hover:text-foreground" @click="openNewTowerDialog">
          <Plus class="size-4" />
        </Button>
      </div>

      <div class="flex-1 overflow-y-auto">
        <div v-if="towers.length === 0" class="px-4 py-8 text-center text-xs text-muted-foreground">
          Noch keine Gassentürme
        </div>
        <button
          v-for="tower in towers"
          :key="tower.id"
          :class="[
            'w-full text-left px-4 py-3 border-b border-border/50 transition-colors hover:bg-muted/40',
            selectedTowerId === tower.id ? 'bg-accent/10 border-l-2 border-l-accent' : ''
          ]"
          @click="selectedTowerId = tower.id"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-medium text-foreground truncate">{{ tower.name }}</span>
            <div class="flex items-center gap-1 shrink-0">
              <span v-if="tower.side" class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{{ tower.side }}</span>
            </div>
          </div>
          <div class="flex items-center justify-between mt-0.5">
            <span class="text-xs text-muted-foreground truncate">{{ tower.stage_area || '–' }}</span>
            <span class="text-[10px] text-muted-foreground shrink-0">
              {{ filledSlotCount(tower) }}/{{ tower.slot_count }} Slots
            </span>
          </div>
        </button>
      </div>
    </div>

    <!-- Rechte Seite: Blueprint -->
    <div class="flex-1 min-w-0 flex flex-col">
      <div v-if="!selectedTower" class="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Gassenturm auswählen
      </div>

      <template v-else>
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-3 border-b border-border bg-card shrink-0">
          <div>
            <h2 class="text-sm font-semibold text-foreground">{{ selectedTower.name }}</h2>
            <p class="text-xs text-muted-foreground">{{ selectedTower.stage_area }}{{ selectedTower.side ? ' · ' + selectedTower.side : '' }}</p>
          </div>
          <div class="flex items-center gap-2">
            <Button variant="ghost" size="sm" class="text-xs text-muted-foreground" @click="openEditTowerDialog(selectedTower)">
              <Pencil class="size-3 mr-1" /> Bearbeiten
            </Button>
            <Button variant="ghost" size="sm" class="text-xs text-red-400 hover:text-red-500 hover:bg-red-500/10" @click="confirmDeleteTower(selectedTower)">
              <Trash2 class="size-3 mr-1" /> Löschen
            </Button>
          </div>
        </div>

        <!-- Slots (Slot 1 = unten, physikalisch korrekt → umgekehrte Reihenfolge) -->
        <div class="flex-1 overflow-y-auto p-4">
          <div class="flex flex-col-reverse gap-2 max-w-lg">
            <div
              v-for="slot in slotsForDisplay"
              :key="slot.slot_index"
              class="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3"
            >
              <!-- Slot-Nummer Badge -->
              <div class="size-8 shrink-0 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                {{ slot.slot_index }}
              </div>

              <!-- Channel-Info oder leer -->
              <div class="flex-1 min-w-0">
                <template v-if="slot.channel_id && channelForId(slot.channel_id)">
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-sm font-semibold text-foreground">{{ channelForId(slot.channel_id)?.channel }}</span>
                    <span v-if="channelForId(slot.channel_id)?.color" class="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {{ channelForId(slot.channel_id)?.color }}
                    </span>
                  </div>
                  <p v-if="channelForId(slot.channel_id)?.device" class="text-xs text-muted-foreground truncate mt-0.5">
                    {{ channelForId(slot.channel_id)?.device }}
                  </p>
                </template>
                <span v-else class="text-xs text-muted-foreground/50 italic">leer</span>
              </div>

              <!-- Slot-Aktion -->
              <div class="shrink-0 flex gap-1">
                <Button
                  v-if="slot.channel_id"
                  variant="ghost"
                  size="icon"
                  class="size-7 text-muted-foreground hover:text-red-400"
                  @click="clearSlot(selectedTower.id, slot.slot_index)"
                >
                  <X class="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-7 text-muted-foreground hover:text-foreground"
                  @click="openSlotPicker(slot)"
                >
                  <ChevronsUpDown class="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>

  <!-- Tower Dialog -->
  <Dialog :open="towerDialogOpen" @update:open="towerDialogOpen = $event">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ editingTower ? 'Gassenturm bearbeiten' : 'Neuer Gassenturm' }}</DialogTitle>
      </DialogHeader>
      <div class="flex flex-col gap-4 py-2">
        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-muted-foreground">Name</label>
          <Input v-model="towerForm.name" placeholder="z. B. Gassenturm 1" autofocus />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-muted-foreground">Bühnenbereich</label>
            <Input v-model="towerForm.stage_area" placeholder="z. B. Vorbühne Links" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-muted-foreground">Seite</label>
            <Input v-model="towerForm.side" placeholder="L / R" class="w-full" />
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-muted-foreground">Anzahl Slots</label>
          <Input v-model.number="towerForm.slot_count" type="number" min="1" max="20" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" @click="towerDialogOpen = false">Abbrechen</Button>
        <Button @click="saveTowerForm">{{ editingTower ? 'Speichern' : 'Anlegen' }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Slot Channel Picker -->
  <Dialog :open="slotPickerOpen" @update:open="slotPickerOpen = $event">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Slot {{ pickerSlot?.slot_index }} · Kanal zuweisen</DialogTitle>
      </DialogHeader>
      <div class="flex flex-col gap-2 py-2">
        <Input v-model="channelPickerSearch" placeholder="Kanalnummer suchen…" autofocus />
        <div class="max-h-64 overflow-y-auto flex flex-col gap-1 mt-1">
          <button
            v-for="ch in filteredChannelsForPicker"
            :key="ch.channel"
            class="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/60 text-left transition-colors"
            @click="pickChannel(ch)"
          >
            <span class="font-mono text-base font-semibold w-12 text-foreground">{{ ch.channel }}</span>
            <span v-if="ch.color" class="text-xs text-muted-foreground">{{ ch.color }}</span>
            <span class="text-xs text-muted-foreground truncate">{{ ch.device }}</span>
          </button>
          <div v-if="filteredChannelsForPicker.length === 0" class="text-xs text-muted-foreground px-3 py-4 text-center">
            Keine Kanäle gefunden
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" @click="slotPickerOpen = false">Abbrechen</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Plus, Pencil, Trash2, X, ChevronsUpDown } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

const props = defineProps({
  towers: { type: Array, required: true },
  channels: { type: Array, required: true },
  activeChannelIds: { type: Array, default: () => [] },
  addTowerFn: { type: Function, required: true },
  saveTowerFn: { type: Function, required: true },
  deleteTowerFn: { type: Function, required: true },
  assignSlotFn: { type: Function, required: true },
})

const selectedTowerId = ref(null)

const selectedTower = computed(() => props.towers.find(t => t.id === selectedTowerId.value) ?? null)

const slotsForDisplay = computed(() => {
  if (!selectedTower.value) return []
  const slots = [...(selectedTower.value.slots ?? [])]
  slots.sort((a, b) => a.slot_index - b.slot_index)
  return slots
})

function filledSlotCount(tower) {
  return (tower.slots ?? []).filter(s => s.channel_id).length
}

const channelById = computed(() => {
  const map = new Map()
  for (const ch of props.channels) map.set(ch.id, ch)
  return map
})

function channelForId(channelId) {
  return channelById.value.get(channelId) ?? null
}

// Tower Dialog
const towerDialogOpen = ref(false)
const editingTower = ref(null)
const towerForm = ref({ name: '', side: '', stage_area: '', slot_count: 4 })

function openNewTowerDialog() {
  editingTower.value = null
  towerForm.value = { name: '', side: '', stage_area: '', slot_count: 4 }
  towerDialogOpen.value = true
}

function openEditTowerDialog(tower) {
  editingTower.value = tower
  towerForm.value = { name: tower.name, side: tower.side, stage_area: tower.stage_area, slot_count: tower.slot_count }
  towerDialogOpen.value = true
}

async function saveTowerForm() {
  if (!towerForm.value.name) return
  if (editingTower.value) {
    await props.saveTowerFn(editingTower.value.id, { ...towerForm.value })
  } else {
    const id = await props.addTowerFn({ ...towerForm.value })
    selectedTowerId.value = id
  }
  towerDialogOpen.value = false
}

function confirmDeleteTower(tower) {
  if (confirm(`Gassenturm "${tower.name}" wirklich löschen?`)) {
    props.deleteTowerFn(tower.id)
    if (selectedTowerId.value === tower.id) selectedTowerId.value = null
  }
}

// Slot Picker
const slotPickerOpen = ref(false)
const pickerSlot = ref(null)
const channelPickerSearch = ref('')

const filteredChannelsForPicker = computed(() => {
  const q = channelPickerSearch.value.trim().toLowerCase()
  return props.channels.filter(ch => {
    if (!q) return true
    return (
      (ch.channel ?? '').toLowerCase().includes(q) ||
      (ch.device ?? '').toLowerCase().includes(q)
    )
  }).slice(0, 50)
})

function openSlotPicker(slot) {
  pickerSlot.value = slot
  channelPickerSearch.value = ''
  slotPickerOpen.value = true
}

function pickChannel(ch) {
  if (!pickerSlot.value || !selectedTower.value) return
  props.assignSlotFn(selectedTower.value.id, pickerSlot.value.slot_index, ch.id)
  slotPickerOpen.value = false
}

function clearSlot(towerId, slotIndex) {
  props.assignSlotFn(towerId, slotIndex, null)
}
</script>
