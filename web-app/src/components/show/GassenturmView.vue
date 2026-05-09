<template>
  <div class="flex flex-col h-full overflow-hidden">
  <div class="flex-1 overflow-x-auto overflow-y-auto p-4">
    <div v-if="towers.length === 0" class="flex items-center justify-center h-48 text-sm text-muted-foreground">
      Noch keine Gassentürme
    </div>

    <!-- 2 Zeilen, responsive Spalten -->
    <div class="grid grid-rows-2 grid-flow-col gap-3" :style="gridStyle">
      <div
        v-for="tower in towers"
        :key="tower.id"
        class="rounded-xl border border-border/60 bg-card overflow-hidden flex flex-col"
      >
        <!-- Header -->
        <div class="flex items-start justify-between px-4 pt-4 pb-3 min-h-20">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-base font-semibold text-foreground truncate">{{ tower.name }}</span>
              <span v-if="tower.side" class="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-accent/15 text-accent">{{ tower.side }}</span>
            </div>
            <div class="flex items-center gap-2 mt-0.5">
              <span v-if="tower.stage_area" class="text-xs text-muted-foreground truncate">{{ tower.stage_area }}</span>
              <span class="text-xs text-muted-foreground/50 shrink-0">{{ tower.slot_count }} Slots</span>
            </div>
          </div>
          <div class="flex items-center gap-0.5 shrink-0 ml-2 -mt-1">
            <Button variant="ghost" size="icon" class="size-7 text-muted-foreground/50 hover:text-foreground" @click="openEditTowerDialog(tower)">
              <Pencil class="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" class="size-7 text-muted-foreground/50 hover:text-destructive" @click="confirmDeleteTower(tower)">
              <Trash2 class="size-3.5" />
            </Button>
          </div>
        </div>

        <!-- Divider -->
        <div class="h-px bg-border mx-4" />

        <!-- Slots -->
        <div :key="slotRenderKey" :ref="el => initSortable(el, tower)" class="flex flex-col flex-1">
          <div
            v-for="slot in slotsFor(tower)"
            :key="slot.slot_index"
            :data-slot-index="slot.slot_index"
            class="flex items-center gap-3 px-4 py-3.5 border-b border-border/60 hover:bg-muted/20 transition-colors"
          >
            <div class="flex items-center gap-1 shrink-0">
              <GripVertical class="drag-handle size-3.5 text-muted-foreground/50 cursor-grab active:cursor-grabbing" />
              <span class="w-4 text-xs text-muted-foreground/40 font-mono text-right">{{ slot.slot_index }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <template v-if="slot.channel_id && channelForId(slot.channel_id)">
                <div class="flex items-center px-2 gap-3 truncate">
                  <span class="font-mono font-bold text-xl text-foreground shrink-0 leading-none">{{ channelForId(slot.channel_id)?.channel }}</span>
                  <template v-if="channelForId(slot.channel_id)?.color">
                    <span class="text-muted-foreground/30 shrink-0">·</span>
                    <span
                      class="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                      :style="filterBadgeStyle(channelForId(slot.channel_id)?.color) ?? { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }"
                    >{{ channelForId(slot.channel_id)?.color }}</span>
                  </template>
                  <template v-if="channelForId(slot.channel_id)?.device">
                    <span class="text-muted-foreground/30 shrink-0">·</span>
                    <span class="text-sm text-foreground truncate">{{ channelForId(slot.channel_id)?.device }}</span>
                  </template>
                </div>
              </template>
              <span v-else class="text-xs text-muted-foreground/60">leer</span>
            </div>
            <div class="shrink-0 flex gap-0.5">
              <Button
                v-if="slot.channel_id"
                variant="ghost"
                size="icon"
                class="size-6 text-muted-foreground/40 hover:text-destructive"
                @click="clearSlot(tower.id, slot.slot_index)"
              >
                <X class="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="size-6 text-muted-foreground/40 hover:text-foreground"
                @click="openSlotPicker(tower, slot)"
              >
                <ChevronsUpDown class="size-3" />
              </Button>
            </div>
          </div>
        </div>

        <!-- Slot hinzufügen -->
        <button
          class="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/20 transition-colors border-t border-border/30"
          @click="addSlot(tower)"
        >
          <Plus class="size-3" />
          Slot hinzufügen
        </button>
      </div>
    </div>
  </div>

  <!-- Neuer Gassenturm -->
  <div class="shrink-0 border-t border-border px-5 py-3 flex justify-end">
    <Button variant="ghost" size="sm" class="text-xs text-muted-foreground border border-dashed border-border/60" @click="openNewTowerDialog">
      <Plus class="size-3 mr-1.5" /> Neuer Gassenturm
    </Button>
  </div>
  </div>

  <!-- Tower Dialog -->
  <Dialog :open="towerDialogOpen" @update:open="towerDialogOpen = $event">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ editingTower ? 'Gassenturm bearbeiten' : 'Neuer Gassenturm' }}</DialogTitle>
      </DialogHeader>
      <DialogBody>
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
      </DialogBody>
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
      <DialogBody>
        <Input v-model="channelPickerSearch" placeholder="Kanalnummer suchen…" autofocus />
        <div class="max-h-64 overflow-y-auto flex flex-col gap-1">
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
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" @click="slotPickerOpen = false">Abbrechen</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { Plus, Pencil, Trash2, X, ChevronsUpDown, GripVertical } from 'lucide-vue-next'
import Sortable from 'sortablejs'
import { filterBadgeStyle } from '@/utils/filterColors.js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'

const props = defineProps({
  towers: { type: Array, required: true },
  channels: { type: Array, required: true },
  activeChannelIds: { type: Array, default: () => [] },
  preselectedChannelId: { type: String, default: null },
  addTowerFn: { type: Function, required: true },
  saveTowerFn: { type: Function, required: true },
  deleteTowerFn: { type: Function, required: true },
  assignSlotFn: { type: Function, required: true },
  pushSnapshotFn: { type: Function, required: true },
})

const emit = defineEmits(['assigned'])

const gridStyle = computed(() => {
  const cols = Math.ceil(props.towers.length / 2) || 1
  return { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }
})

const channelById = computed(() => {
  const map = new Map()
  for (const ch of props.channels) map.set(ch.id, ch)
  return map
})

function channelForId(channelId) {
  return channelById.value.get(channelId) ?? null
}

function slotsFor(tower) {
  const slots = [...(tower.slots ?? [])]
  slots.sort((a, b) => a.slot_index - b.slot_index)
  return slots
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
    await props.addTowerFn({ ...towerForm.value })
  }
  towerDialogOpen.value = false
}

function confirmDeleteTower(tower) {
  if (confirm(`Gassenturm "${tower.name}" wirklich löschen?`)) {
    props.pushSnapshotFn()
    props.deleteTowerFn(tower.id)
  }
}

async function addSlot(tower) {
  props.pushSnapshotFn()
  await props.saveTowerFn(tower.id, { slot_count: tower.slot_count + 1 })
}

// Slot Picker
const slotPickerOpen = ref(false)
const pickerSlot = ref(null)
const pickerTower = ref(null)
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

function openSlotPicker(tower, slot) {
  pickerTower.value = tower
  pickerSlot.value = slot
  channelPickerSearch.value = ''
  slotPickerOpen.value = true
}

function pickChannel(ch) {
  if (!pickerTower.value) return
  const slotIndex = pickerSlot.value?.slot_index ?? 0
  props.pushSnapshotFn()
  props.assignSlotFn(pickerTower.value.id, slotIndex, ch.id)
  slotPickerOpen.value = false
  emit('assigned')
}

watch(() => props.preselectedChannelId, (id) => {
  if (!id) return
  channelPickerSearch.value = props.channels.find(c => c.id === id)?.channel ?? ''
  pickerSlot.value = null
  slotPickerOpen.value = true
})

// Drag & Drop
const sortableInstances = new Map()
const slotRenderKey = ref(0)

function initSortable(el, tower) {
  if (!el) return
  if (sortableInstances.has(tower.id)) {
    sortableInstances.get(tower.id).destroy()
  }
  const instance = Sortable.create(el, {
    animation: 150,
    handle: '.drag-handle',
    onEnd({ oldIndex, newIndex }) {
      if (oldIndex === newIndex) return
      const slots = slotsFor(tower)
      const fromSlot = slots[oldIndex]
      const toSlot = slots[newIndex]
      if (!fromSlot || !toSlot) return
      props.pushSnapshotFn()
      slotRenderKey.value++
      props.assignSlotFn(tower.id, fromSlot.slot_index, toSlot.channel_id ?? null)
      props.assignSlotFn(tower.id, toSlot.slot_index, fromSlot.channel_id ?? null)
    },
  })
  sortableInstances.set(tower.id, instance)
}

onBeforeUnmount(() => {
  for (const inst of sortableInstances.values()) inst.destroy()
})

function clearSlot(towerId, slotIndex) {
  props.pushSnapshotFn()
  props.assignSlotFn(towerId, slotIndex, null)
}
</script>
