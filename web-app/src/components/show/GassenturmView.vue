<template>
  <div class="relative flex flex-col h-full overflow-hidden">
<div class="flex-1 overflow-y-auto p-4 pb-14 md:pb-0">
    <div v-if="towers.length === 0" class="flex items-center justify-center h-48 text-sm text-muted-foreground">
      {{ t('gassenturm.empty') }}
    </div>

    <div class="flex flex-wrap gap-3">
      <div
        v-for="tower in towers"
        :key="tower.id"
        class="rounded-xl border border-border/60 bg-card overflow-hidden flex flex-col w-full sm:w-100"
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
              <span class="text-xs text-muted-foreground/80 shrink-0">{{ tower.slot_count }} Slots</span>
            </div>
          </div>
          <div class="flex items-center gap-0.5 shrink-0 ml-2 -mt-1">
            <Button variant="ghost" size="icon" class="size-7 text-muted-foreground/50" @click="openEditTowerDialog(tower)">
              <Pencil class="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" class="size-7 text-muted-foreground/50" @click="confirmDeleteTower(tower)">
              <Trash2 class="size-3.5" />
            </Button>
          </div>
        </div>

        <!-- Divider -->
        <div class="h-px bg-border mx-4" />

        <!-- Slots -->
        <div
          :key="slotRenderKey"
          :ref="el => initSortable(el, tower)"
          class="flex-1"
          style="display: grid; grid-template-columns: auto 3.5rem 3rem auto 1fr auto; grid-auto-rows: 3.25rem;"
        >
          <template
            v-for="slot in slotsFor(tower)"
            :key="slot.slot_index"
            :data-slot-index="slot.slot_index"
          >
            <!-- Drag handle + Slot-Nr -->
            <div class="flex items-center gap-1 pl-4 pr-2 py-3.5 border-b border-border/60 hover:bg-muted/20 transition-colors" @click.stop>
              <GripVertical class="drag-handle size-3.5 text-muted-foreground/50 cursor-grab active:cursor-grabbing" />
              <span class="w-4 text-xs text-muted-foreground/70 font-mono text-right">{{ slot.slot_index }}</span>
            </div>
            <!-- Kanalnummer -->
            <div class="flex items-center py-3.5 border-b border-border/60 hover:bg-muted/20 transition-colors">
              <span v-if="slot.channel_id && channelForId(slot.channel_id)" class="font-mono font-bold text-xl text-foreground leading-none">{{ channelForId(slot.channel_id)?.channel }}</span>
              <span v-else class="text-xs text-muted-foreground/80">{{ t('gassenturm.slot_empty') }}</span>
            </div>
            <!-- Farb-Badge (immer gleich breit) -->
            <div class="flex items-center justify-center py-3.5 border-b border-border/60 hover:bg-muted/20 transition-colors">
              <span
                v-if="slot.channel_id && channelForId(slot.channel_id)?.color"
                class="text-[10px] px-1.5 py-0.5 rounded font-medium"
                :style="filterBadgeStyle(channelForId(slot.channel_id)?.color) ?? { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }"
              >{{ channelForId(slot.channel_id)?.color }}</span>
            </div>
            <!-- Separator -->
            <div class="flex items-center py-3.5 border-b border-border/60 hover:bg-muted/20 transition-colors">
              <span v-if="slot.channel_id && channelForId(slot.channel_id)?.device" class="text-muted-foreground/50 px-1">·</span>
            </div>
            <!-- Device -->
            <div class="flex items-center py-3.5 border-b border-border/60 hover:bg-muted/20 transition-colors min-w-0">
              <span v-if="slot.channel_id && channelForId(slot.channel_id)?.device" class="text-sm text-foreground truncate flex items-baseline gap-1">
                <span v-if="showQuantity(slot.channel_id)">{{ channelForId(slot.channel_id)?.quantity }}</span>
                {{ channelForId(slot.channel_id)?.device }}
              </span>
            </div>
            <!-- Aktionen -->
            <div class="flex items-center gap-0.5 pr-4 py-3.5 border-b border-border/60 hover:bg-muted/20 transition-colors shrink-0">
              <Button
                v-if="slot.channel_id"
                variant="ghost"
                size="icon"
                class="size-6 text-muted-foreground/40"
                @click.stop="clearSlot(tower.id, slot.slot_index)"
              >
                <X class="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="size-6 text-muted-foreground/40"
                @click.stop="openSlotPicker(tower, slot)"
              >
                <ChevronsUpDown class="size-3" />
              </Button>
            </div>
          </template>
        </div>

        <!-- Slot hinzufügen -->
        <button
          class="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/20 transition-colors border-t border-border/30"
          @click="addSlot(tower)"
        >
          <Plus class="size-3" />
          {{ t('gassenturm.add_slot') }}
        </button>

        <!-- Notiz -->
        <div v-if="tower.notes || editingNoteId === tower.id" class="px-4 pt-3 pb-3 border-t border-border/30">
          <textarea
            :value="tower.notes"
            placeholder="Notiz…"
            rows="1"
            class="w-full text-sm text-foreground/80 bg-transparent border border-border/40 rounded-lg px-3 py-2 resize-none outline-none placeholder:text-muted-foreground/60 focus:border-ring focus:ring-1 focus:ring-ring overflow-hidden"
            style="field-sizing: content; min-height: 2.25rem;"
            @focus="editingNoteId = tower.id"
            @blur="editingNoteId = null"
            @change="saveNotes(tower, $event.target.value)"
          />
        </div>
        <button
          v-else
          class="mx-4 mt-2 mb-3 text-left text-xs text-muted-foreground/60 hover:text-muted-foreground/80 transition-colors"
          @click="editingNoteId = tower.id"
        >{{ t('gassenturm.add_note') }}</button>
      </div>
    </div>

  </div>

  <!-- Neuer Gassenturm -->
  <Button variant="accent" @click="openNewTowerDialog" class="absolute bottom-20 right-6 md:bottom-6 h-11 px-5 rounded-full shadow-lg flex items-center gap-2">
    <Plus class="size-4" /> {{ t('gassenturm.new') }}
  </Button>
  </div>

  <!-- Tower Dialog -->
  <Dialog :open="towerDialogOpen" @update:open="towerDialogOpen = $event">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ editingTower ? t('gassenturm.dialog.edit') : t('gassenturm.dialog.new') }}</DialogTitle>
      </DialogHeader>

      <!-- Formular -->
      <DialogBody>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-muted-foreground">{{ t('gassenturm.field.name') }}</label>
          <Input size="lg" v-model="towerForm.name" placeholder="z. B. Gassenturm 1" autofocus />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-muted-foreground">{{ t('gassenturm.field.stage_area') }}</label>
            <Input size="lg" v-model="towerForm.stage_area" placeholder="z. B. Vorbühne Links" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-muted-foreground">{{ t('gassenturm.field.side') }}</label>
            <Input size="lg" v-model="towerForm.side" placeholder="L / R" class="w-full" />
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-muted-foreground">{{ t('gassenturm.field.slot_count') }}</label>
          <Input size="lg" v-model.number="towerForm.slot_count" type="number" min="1" max="20" />
        </div>

        <!-- Warnbereich bei Slot-Reduktion -->
        <div v-if="slotReduceConfirm" class="rounded-lg border border-destructive/40 bg-destructive/5 px-3.5 py-3 flex flex-col gap-1.5">
          <p class="text-sm font-medium text-foreground">
            {{ t('gassenturm.slots.removed', { from: slotReduceConfirm.newCount + 1, to: slotReduceConfirm.oldCount }) }}
          </p>
          <ul v-if="slotReduceConfirm.removedWithChannel.length > 0" class="flex flex-col gap-0.5">
            <li
              v-for="s in slotReduceConfirm.removedWithChannel"
              :key="s.slot_index"
              class="text-xs font-mono text-foreground/70"
            >Slot {{ s.slot_index }} · Kanal {{ channelForId(s.channel_id)?.channel }}</li>
          </ul>
          <p v-else class="text-xs text-muted-foreground">{{ t('gassenturm.slots.empty') }}</p>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" @click="towerDialogOpen = false">{{ t('action.cancel') }}</Button>
        <template v-if="slotReduceConfirm">
          <Button variant="ghost" @click="slotReduceConfirm = null">{{ t('action.back') }}</Button>
          <Button variant="destructive" @click="confirmSlotReduce">{{ t('gassenturm.action.remove') }}</Button>
        </template>
        <Button v-else @click="saveTowerForm">{{ editingTower ? t('action.save') : t('gassenturm.action.create') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Slot Channel Picker -->
  <Dialog :open="slotPickerOpen" @update:open="slotPickerOpen = $event">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ t('gassenturm.slot.assign', { slot: pickerSlot?.slot_index }) }}</DialogTitle>
      </DialogHeader>
      <!-- Inline-Bestätigung bei belegtem Slot -->
      <!-- Kanalsuche -->
      <DialogBody>
        <Input ref="pickerInputRef" size="lg" v-model="channelPickerSearch" placeholder="Kanalnummer suchen…" autofocus @keydown.enter="pickFirstResult" />
        <div class="max-h-64 overflow-y-auto flex flex-col">
          <button
            v-for="ch in filteredChannelsForPicker"
            :key="ch.channel"
            class="flex items-center gap-4 px-4 py-3 text-left transition-colors border-b border-border/30 last:border-b-0"
            :class="confirmPending?.id === ch.id ? 'bg-accent/10' : 'hover:bg-muted/40'"
            @click="pickChannel(ch)"
          >
            <span class="text-2xl font-bold tabular-nums w-10 shrink-0 text-foreground">{{ ch.channel }}</span>
            <div class="flex flex-col min-w-0 flex-1">
              <span class="text-sm font-semibold text-foreground truncate">{{ ch.device }}</span>
              <span v-if="ch.address || ch.color" class="text-xs text-muted-foreground mt-0.5">
                <span v-if="ch.address">DMX {{ ch.address }}</span><span v-if="ch.address && ch.color"> · </span><span v-if="ch.color">{{ ch.color }}</span>
              </span>
            </div>
          </button>
          <div v-if="filteredChannelsForPicker.length === 0" class="text-xs text-muted-foreground px-4 py-4 text-center">
            {{ t('gassenturm.channel.none') }}
          </div>
        </div>

        <!-- Warnbereich bei belegtem Slot -->
        <div v-if="confirmPending" class="rounded-lg border border-destructive/40 bg-destructive/5 px-3.5 py-3">
          <p class="text-sm font-medium text-foreground">
            {{ t('gassenturm.slot.occupied', { slot: pickerSlot?.slot_index, channel: channelForId(pickerSlot?.channel_id)?.channel }) }}
          </p>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" @click="slotPickerOpen = false">{{ t('action.cancel') }}</Button>
        <template v-if="confirmPending">
          <Button variant="ghost" @click="confirmPending = null">{{ t('action.back') }}</Button>
          <Button variant="destructive" @click="confirmOverwrite">{{ t('gassenturm.action.overwrite') }}</Button>
        </template>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'
import { useLocale } from '@/composables/useLocale.js'
const { t } = useLocale()
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


const channelById = computed(() => {
  const map = new Map()
  for (const ch of props.channels) map.set(ch.id, ch)
  return map
})

function channelForId(channelId) {
  return channelById.value.get(channelId) ?? null
}

const channelUsageCount = computed(() => {
  const counts = new Map()
  for (const tower of props.towers) {
    for (const slot of tower.slots ?? []) {
      if (slot.channel_id) counts.set(slot.channel_id, (counts.get(slot.channel_id) ?? 0) + 1)
    }
  }
  return counts
})

function showQuantity(channelId) {
  const ch = channelForId(channelId)
  return ch && (ch.quantity ?? 1) > 1 && (channelUsageCount.value.get(channelId) ?? 0) === 1
}

function slotsFor(tower) {
  const slots = [...(tower.slots ?? [])]
  slots.sort((a, b) => a.slot_index - b.slot_index)
  return slots
}

// Notiz
const editingNoteId = ref(null)

async function saveNotes(tower, value) {
  await props.saveTowerFn(tower.id, { notes: value })
}

// Tower Dialog
const towerDialogOpen = ref(false)
const editingTower = ref(null)
const towerForm = ref({ name: '', side: '', stage_area: '', slot_count: 4 })
const slotReduceConfirm = ref(null)

function openNewTowerDialog() {
  editingTower.value = null
  towerForm.value = { name: '', side: '', stage_area: '', slot_count: 4 }
  towerDialogOpen.value = true
}

function openEditTowerDialog(tower) {
  editingTower.value = tower
  towerForm.value = { name: tower.name, side: tower.side, stage_area: tower.stage_area, slot_count: tower.slot_count }
  slotReduceConfirm.value = null
  towerDialogOpen.value = true
}

async function saveTowerForm() {
  if (!towerForm.value.name) return
  if (editingTower.value) {
    const oldCount = editingTower.value.slot_count
    const newCount = towerForm.value.slot_count
    if (newCount < oldCount) {
      const removedSlots = slotsFor(editingTower.value).filter(s => s.slot_index > newCount)
      const removedWithChannel = removedSlots.filter(s => s.channel_id && channelForId(s.channel_id))
      slotReduceConfirm.value = { oldCount, newCount, removedWithChannel }
      return
    }
    await props.saveTowerFn(editingTower.value.id, { ...towerForm.value })
  } else {
    await props.addTowerFn({ ...towerForm.value })
  }
  towerDialogOpen.value = false
}

async function confirmSlotReduce() {
  slotReduceConfirm.value = null
  await props.saveTowerFn(editingTower.value.id, { ...towerForm.value })
  towerDialogOpen.value = false
}

function confirmDeleteTower(tower) {
  if (confirm(t('gassenturm.delete.confirm', { name: tower.name }))) {
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
const pickerInputRef = ref(null)
const confirmPending = ref(null) // channel to assign after overwrite confirmation

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
  confirmPending.value = null
  slotPickerOpen.value = true
}

async function pickFirstResult() {
  const first = filteredChannelsForPicker.value[0]
  if (!first || !pickerTower.value) return
  const existing = pickerSlot.value?.channel_id ? channelForId(pickerSlot.value.channel_id) : null
  if (existing && existing.id !== first.id) {
    confirmPending.value = first
    return
  }
  void doAssign(first)
}

function pickChannel(ch) {
  if (!pickerTower.value) return
  const existing = pickerSlot.value?.channel_id ? channelForId(pickerSlot.value.channel_id) : null
  if (existing && existing.id !== ch.id) {
    confirmPending.value = ch
    return
  }
  void doAssign(ch)
}

async function confirmOverwrite() {
  if (confirmPending.value) await doAssign(confirmPending.value)
  confirmPending.value = null
}

async function doAssign(ch) {
  if (!pickerTower.value) return
  const slotIndex = pickerSlot.value?.slot_index ?? 0
  const tower = pickerTower.value
  props.pushSnapshotFn()
  props.assignSlotFn(tower.id, slotIndex, ch.id)
  emit('assigned')

  const nextSlot = slotsFor(tower).find(s => s.slot_index === slotIndex + 1)
  if (nextSlot && !nextSlot.channel_id) {
    pickerSlot.value = nextSlot
    channelPickerSearch.value = ''
    confirmPending.value = null
    await nextTick()
    pickerInputRef.value?.$el?.querySelector('input')?.focus()
  } else {
    slotPickerOpen.value = false
  }
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

<style scoped>
@keyframes bounce-x {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(5px); }
}
.animate-bounce-x {
  animation: bounce-x 1.2s ease-in-out infinite;
}
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
