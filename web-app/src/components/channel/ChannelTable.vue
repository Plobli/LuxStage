<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Sticky Header -->
    <div class="shrink-0 border-b border-border bg-card">
      <Table class="table-fixed">
        <colgroup>
          <col class="w-8" />
          <col class="w-36" />
          <col class="w-22" />
          <col class="w-[28%]" />
          <col />
          <col class="w-10" />
        </colgroup>
        <TableHeader>
          <TableRow class="border-0 hover:bg-transparent">
            <TableHead class="p-0 h-auto"></TableHead>
            <TableHead class="py-2.5 pr-4 pl-0 h-auto text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{{ labels.channel }}</TableHead>
            <TableHead class="px-4 py-2.5 h-auto text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{{ labels.color }}</TableHead>
            <TableHead class="px-3 py-2.5 h-auto text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{{ labels.device }}</TableHead>
            <TableHead class="px-3 py-2.5 h-auto text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{{ labels.notes }}</TableHead>
            <TableHead class="p-0 h-auto"></TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    </div>

    <!-- Scrollable Body -->
    <div class="flex-1 min-h-0 overflow-y-auto">
      <div>
        <Table class="table-fixed">
          <colgroup>
            <col class="w-8" />
            <col class="w-36" />
            <col class="w-22" />
            <col class="w-[28%]" />
            <col />
            <col class="w-10" />
          </colgroup>
          <TableBody ref="tbodyEl">
            <template v-for="item in virtualItems" :key="item.id">

              <!-- Group header -->
              <TableRow
                v-if="item.type === 'header'"
                class="border-t border-border bg-muted/40 hover:bg-muted/40"
                data-no-drag
                :data-pos="item.group.position"
              >
                <TableCell colspan="6" class="py-2 pr-4 pl-2">
                  <div class="flex items-center gap-2">
                    <template v-if="editingPosition === item.group.position">
                      <Input
                        v-model="editingPositionValue"
                        autofocus
                        @blur="savePosition"
                        @keydown.enter="savePosition"
                        @keydown.escape="editingPosition = null"
                        class="h-6 bg-transparent border-0 border-b border-accent rounded-none focus-visible:ring-0 px-0 text-[10px] font-semibold text-foreground uppercase tracking-widest w-80 shadow-none"
                      />
                    </template>
                    <template v-else>
                      <Button
                        variant="ghost"
                        size="sm"
                        class="h-auto p-0 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest hover:text-foreground hover:bg-transparent transition-colors"
                        :title="labels.editPosition"
                        @click="startEditPosition(item.group.position)"
                      >{{ item.group.position || labels.noCategory }}</Button>
                      <span class="text-[10px] font-normal text-muted-foreground/60">{{ item.group.channels.length }}</span>
                    </template>
                  </div>
                </TableCell>
              </TableRow>

              <!-- Channel row -->
              <ChannelRow
                v-else-if="item.type === 'channel'"
                :ch="item.ch"
                :rowIndex="rowIndexOf(item.ch)"
                :dupChannelNrs="dupChannelNrs"
                :channelStatus="channelStatus(item.ch)"
                :colorPlaceholder="labels.color"
                :deleteTitle="labels.delete"
                :onKeydownFn="onKeydownFn"
                :onAddRow="() => startAdd(item.group.position)"
                @change="emit('change')"
                @recordFocus="emit('recordFocus')"
                @commitFocus="emit('commitFocus')"
                @pushSnapshot="emit('pushSnapshot')"
                @toggleStatus="toggleChannelStatus(item.ch)"
                @delete="emit('deleteChannel', item.ch)"
                @insertAfter="insertAfter(item.ch)"
              />

              <!-- Add button -->
              <TableRow
                v-else-if="item.type === 'add-btn'"
                class="border-t border-border hover:bg-transparent"
                data-no-drag
              >
                <TableCell colspan="6" class="py-2.5 pl-2">
                  <Button
                    variant="outline"
                    size="sm"
                    class="text-muted-foreground hover:text-foreground border-dashed"
                    @click="startAdd(item.group.position)"
                  >+ {{ labels.add }}</Button>
                </TableCell>
              </TableRow>

              <!-- Add form -->
              <TableRow
                v-else-if="item.type === 'add-form'"
                class="border-t border-border bg-muted/20 hover:bg-muted/20"
                data-no-drag
                @keydown.escape="addingPosition = null"
                @keydown.enter.prevent="saveAdd"
              >
                <TableCell class="w-8 p-0"></TableCell>
                <TableCell class="py-2 pr-4 pl-0 align-middle">
                  <div class="flex items-center gap-1.5">
                    <Input
                      autofocus
                      v-model="addForm.channel"
                      :placeholder="labels.channelNr"
                      class="bg-background/50 border border-border/40 focus-visible:bg-background focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring text-lg font-bold font-mono text-foreground px-1.5 py-0 w-[5.5ch] text-center leading-none shadow-sm h-8 transition-colors hover:border-border placeholder:text-muted-foreground/40"
                    />
                    <span class="text-muted-foreground/30 font-mono text-sm select-none">/</span>
                    <Input
                      v-model="addForm.address"
                      :placeholder="labels.addressExample"
                      class="bg-background/50 border border-border/40 focus-visible:bg-background focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring text-xs text-muted-foreground px-1.5 py-0 w-[8ch] text-center shadow-sm h-8 transition-colors hover:border-border placeholder:text-muted-foreground/30"
                    />
                  </div>
                </TableCell>
                <TableCell class="px-4 py-2 align-middle">
                  <ColorAutocomplete v-model="addForm.color" @change="() => {}" :placeholder="labels.color" />
                </TableCell>
                <TableCell class="px-3 py-2 align-middle">
                  <Textarea
                    v-model="addForm.device"
                    class="bg-background/50 border border-border/40 hover:border-border focus-visible:bg-background focus-visible:outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring text-sm text-foreground w-full px-2.5 resize-none leading-snug min-h-10 py-2 rounded-md shadow-sm transition-colors"
                  />
                </TableCell>
                <TableCell class="px-3 py-2 align-middle">
                  <Textarea
                    v-model="addForm.notes"
                    class="bg-background/50 border border-border/40 hover:border-border focus-visible:bg-background focus-visible:outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring text-sm text-foreground w-full px-2.5 resize-none leading-snug min-h-10 py-2 rounded-md shadow-sm transition-colors"
                  />
                </TableCell>
                <TableCell class="py-2 pl-1 pr-1 align-middle text-center">
                  <Button
                    size="icon"
                    variant="ghost"
                    class="size-7 text-green-400 hover:bg-green-500/10 hover:text-green-300"
                    @click="saveAdd"
                  ><Check class="size-4" /></Button>
                </TableCell>
              </TableRow>

              <!-- Empty state -->
              <TableRow
                v-else-if="item.type === 'empty'"
                class="hover:bg-transparent"
                data-no-drag
              >
                <TableCell colspan="6" class="py-10 px-4">
                  <div class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/10 px-6 py-8">
                    <p class="text-sm text-muted-foreground">{{ labels.empty }}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      class="text-muted-foreground hover:text-foreground border-dashed"
                      @click="startAdd('')"
                    >+ {{ labels.add }}</Button>
                  </div>
                </TableCell>
              </TableRow>

            </template>
          </TableBody>
        </Table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { Check } from 'lucide-vue-next'
import Sortable from 'sortablejs'
import ChannelRow from './ChannelRow.vue'
import ColorAutocomplete from '../ColorAutocomplete.vue'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

const props = defineProps({
  channels: { type: Array, required: true },
  groupedChannels: { type: Array, required: true },
  dupChannelNrs: { type: Set, default: () => new Set() },
  channelStatusFn: { type: Function, required: true },
  toggleChannelStatusFn: { type: Function, required: true },
  onKeydownFn: { type: Function, default: null },
  labels: {
    type: Object,
    default: () => ({
      channel: 'Kanal', color: 'Farbe', device: 'Gerät', notes: 'Notizen',
      editPosition: 'Bearbeiten', noCategory: '–', add: 'Kanal hinzufügen',
      delete: 'Löschen', empty: 'Keine Kanäle', channelNr: 'Nr', addressExample: 'z.B. 1',
    }),
  },
})

const emit = defineEmits([
  'change',
  'recordFocus',
  'commitFocus',
  'pushSnapshot',
  'deleteChannel',
  'reorder',
])

// ── Add form ───────────────────────────────────────────────────────────────
const addingPosition = ref(null)
const addForm = ref({})

// ── Flat list for virtual scrolling ───────────────────────────────────────
const virtualItems = computed(() => {
  const items = []
  if (props.groupedChannels.length === 0) {
    if (addingPosition.value === '') {
      items.push({ id: 'add-form-empty', type: 'add-form', group: { position: '' } })
    } else {
      items.push({ id: 'empty', type: 'empty' })
    }
    return items
  }
  for (const group of props.groupedChannels) {
    items.push({ id: `header-${group.position}`, type: 'header', group })
    for (const ch of group.channels) {
      items.push({ id: `ch-${ch.channel}-${ch.address}`, type: 'channel', ch, group })
    }
    if (addingPosition.value === group.position) {
      items.push({ id: `add-form-${group.position}`, type: 'add-form', group })
    } else {
      items.push({ id: `add-btn-${group.position}`, type: 'add-btn', group })
    }
  }
  return items
})

// ── Row index helpers ──────────────────────────────────────────────────────
const flatChannels = computed(() => props.groupedChannels.flatMap(g => g.channels))

function rowIndexOf(ch) {
  return flatChannels.value.findIndex(c => c === ch)
}

function channelStatus(ch) {
  return props.channelStatusFn(ch)
}

function toggleChannelStatus(ch) {
  props.toggleChannelStatusFn(ch)
}

// ── Position editing ───────────────────────────────────────────────────────
const editingPosition = ref(null)
const editingPositionValue = ref('')

function startEditPosition(position) {
  editingPosition.value = position
  editingPositionValue.value = position
}

function savePosition() {
  const oldPos = editingPosition.value
  const newPos = editingPositionValue.value.trim()
  if (newPos && newPos !== oldPos) {
    emit('pushSnapshot')
    for (const ch of props.channels) {
      if (ch.position === oldPos) ch.position = newPos
    }
    emit('change')
  }
  editingPosition.value = null
}

// ── Add channel ────────────────────────────────────────────────────────────
function startAdd(position) {
  addingPosition.value = position
  addForm.value = { channel: '', address: '', device: '', position, color: '', notes: '' }
}

function saveAdd() {
  if (!addForm.value.channel) return
  emit('pushSnapshot')
  const newCh = { ...addForm.value }
  const newNr = parseInt(newCh.channel)
  const idx = props.channels.findIndex(c => parseInt(c.channel) > newNr)
  if (idx === -1) props.channels.push(newCh)
  else props.channels.splice(idx, 0, newCh)
  addingPosition.value = null
  emit('change')
}

// ── Insert after (context menu) ────────────────────────────────────────────
function insertAfter(ch) {
  emit('pushSnapshot')
  const idx = props.channels.findIndex(c => c === ch)
  const newCh = { channel: '', address: '', device: '', position: ch.position, color: '', notes: '' }
  if (idx === -1) props.channels.push(newCh)
  else props.channels.splice(idx + 1, 0, newCh)
  emit('change')
}

// ── SortableJS ─────────────────────────────────────────────────────────────
const tbodyEl = ref(null)
let sortableInstance = null

function initSortable() {
  sortableInstance?.destroy()
  sortableInstance = null
  const el = tbodyEl.value?.$el || tbodyEl.value
  if (!el) return
  sortableInstance = Sortable.create(el, {
    handle: '.drag-handle',
    filter: '[data-no-drag]',
    preventOnFilter: false,
    animation: 150,
    onEnd() {
      const keyToChannel = new Map(props.channels.map(c => [c.channel + '|' + c.address, c]))
      const reordered = []
      let currentPos = ''
      for (const tr of el.rows || el.children) {
        if (tr.hasAttribute('data-no-drag') && 'pos' in tr.dataset) {
          currentPos = tr.dataset.pos
        }
        const key = tr.dataset.chKey
        if (key && keyToChannel.has(key)) {
          const ch = keyToChannel.get(key)
          ch.position = currentPos
          reordered.push(ch)
          keyToChannel.delete(key)
        }
      }
      for (const ch of props.channels) {
        if (keyToChannel.has(ch.channel + '|' + ch.address)) {
          reordered.push(ch)
        }
      }
      if (reordered.length === props.channels.length) {
        emit('pushSnapshot')
        emit('reorder', reordered)
      }
      emit('change')
      nextTick(initSortable)
    },
  })
}

watch(() => props.channels.length, () => nextTick(initSortable))
watch(tbodyEl, (el) => { if (el) nextTick(initSortable) }, { immediate: true })
onBeforeUnmount(() => { sortableInstance?.destroy() })
</script>
