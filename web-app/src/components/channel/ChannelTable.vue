<template>
  <div v-bind="containerProps" class="h-full overflow-y-auto px-2 pb-3 sm:px-3">
    <!-- Sticky Header Table -->
    <table class="min-w-full overflow-x-auto sticky top-0 z-20 bg-gray-900/95 backdrop-blur supports-[backdrop-filter]:bg-gray-900/80">
      <colgroup>
        <col class="w-4" />
        <col class="w-24" />
        <col class="w-20" />
        <col class="w-[30ch]" />
        <col />
        <col class="w-6" />
      </colgroup>
      <TableHeader>
        <TableRow class="border-b border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.18)] hover:bg-transparent">
          <TableHead class="w-4 p-0"></TableHead>
          <TableHead class="py-3 pr-4 pl-0 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-[0.18em] h-auto">{{ labels.channel }}</TableHead>
          <TableHead class="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-[0.18em] h-auto">{{ labels.color }}</TableHead>
          <TableHead class="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-[0.18em] h-auto">{{ labels.device }}</TableHead>
          <TableHead class="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-[0.18em] h-auto">{{ labels.notes }}</TableHead>
          <TableHead class="w-6 p-0"></TableHead>
        </TableRow>
      </TableHeader>
    </table>

    <!-- Virtualized Body -->
    <div v-bind="wrapperProps">
      <table class="min-w-full overflow-x-auto">
        <colgroup>
          <col class="w-4" />
          <col class="w-24" />
          <col class="w-20" />
          <col class="w-[30ch]" />
          <col />
          <col class="w-6" />
        </colgroup>
        <TableBody ref="tbodyEl">
          <template v-for="item in list" :key="item.data.id">
            <!-- Group header -->
            <TableRow v-if="item.data.type === 'header'" class="border-t border-white/5 bg-white/[0.02] hover:bg-white/[0.02]" data-no-drag :data-pos="item.data.group.position">
              <TableCell colspan="6" class="py-2.5 pr-4 pl-0 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-[0.18em]">
                <template v-if="editingPosition === item.data.group.position">
                  <Input
                    v-model="editingPositionValue"
                    autofocus
                    @blur="savePosition"
                    @keydown.enter="savePosition"
                    @keydown.escape="editingPosition = null"
                    class="h-6 bg-transparent border-0 border-b border-accent rounded-none focus-visible:ring-0 px-0 text-xs font-semibold text-white uppercase tracking-wide w-40"
                  />
                </template>
                <template v-else>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-auto p-0 hover:text-white transition-colors text-[11px] font-semibold text-gray-500 uppercase tracking-[0.18em]"
                    :title="labels.editPosition"
                    @click="startEditPosition(item.data.group.position)"
                  >
                    {{ item.data.group.position || labels.noCategory }}
                  </Button>
                  <span class="ml-2 font-normal normal-case text-gray-600">{{ item.data.group.channels.length }}</span>
                </template>
              </TableCell>
            </TableRow>

            <!-- Channel rows -->
            <ChannelRow
              v-else-if="item.data.type === 'channel'"
              :ch="item.data.ch"
              :rowIndex="rowIndexOf(item.data.ch)"
              :dupChannelNrs="dupChannelNrs"
              :channelStatus="channelStatus(item.data.ch)"
              :colorPlaceholder="labels.color"
              :deleteTitle="labels.delete"
              :onKeydownFn="onKeydownFn"
              :onAddRow="() => startAdd(item.data.group.position)"
              @change="emit('change')"
              @recordFocus="emit('recordFocus')"
              @commitFocus="emit('commitFocus')"
              @pushSnapshot="emit('pushSnapshot')"
              @toggleStatus="toggleChannelStatus(item.data.ch)"
              @delete="emit('deleteChannel', item.data.ch)"
              @insertAfter="insertAfter(item.data.ch)"
            />

            <!-- Add row button -->
            <TableRow v-else-if="item.data.type === 'add-btn'" class="no-print border-t border-white/5 hover:bg-transparent" data-no-drag>
              <TableCell colspan="6" class="py-3 pl-0">
                <Button variant="outline" size="sm" class="border-white/10 bg-white/[0.03] text-gray-400 hover:bg-white/[0.06] hover:text-white" @click="startAdd(item.data.group.position)">
                  + {{ labels.add }}
                </Button>
              </TableCell>
            </TableRow>

            <!-- Add row form -->
            <TableRow
              v-else-if="item.data.type === 'add-form'"
              class="border-t border-white/5 bg-white/[0.04] hover:bg-white/[0.04]"
              data-no-drag
              @keydown.escape="addingPosition = null"
              @keydown.enter.prevent="saveAdd"
            >
              <TableCell class="w-4 p-0"></TableCell>
              <TableCell class="py-2 pr-4 pl-0 align-middle">
                <div class="flex flex-col items-center gap-1 rounded-lg border border-white/10 bg-black/10 px-2 py-2">
                  <Input autofocus class="h-8 bg-transparent focus-visible:ring-0 text-2xl font-bold font-mono text-white px-0 border-0 leading-none w-[4ch] text-center shadow-none" v-model="addForm.channel" :placeholder="labels.channelNr" />
                  <Input class="h-5 bg-transparent focus-visible:ring-0 text-xs text-gray-500 px-0 border-0 w-[5ch] text-center shadow-none" v-model="addForm.address" :placeholder="labels.addressExample" />
                </div>
              </TableCell>
              <TableCell class="px-4 py-2 align-middle">
                <ColorAutocomplete v-model="addForm.color" @change="() => {}" :placeholder="labels.color" />
              </TableCell>
              <TableCell class="px-4 py-0 align-middle"><Textarea class="bg-black/10 border-white/10 focus-visible:ring-accent/60 text-sm text-gray-300 w-full resize-none leading-snug min-h-14 shadow-none" v-model="addForm.device" /></TableCell>
              <TableCell class="px-4 py-0 align-middle"><Textarea class="bg-black/10 border-white/10 focus-visible:ring-accent/60 text-sm text-gray-300 w-full resize-none leading-snug min-h-14 shadow-none" v-model="addForm.notes" /></TableCell>
              <TableCell class="py-2 pl-2 pr-0 align-middle"><Button size="icon" variant="ghost" class="size-8 text-green-400 hover:bg-green-500/10 hover:text-green-300" @click="saveAdd">✓</Button></TableCell>
            </TableRow>

            <!-- Empty state -->
            <TableRow v-else-if="item.data.type === 'empty'" class="border-t border-white/5 hover:bg-transparent" data-no-drag>
              <TableCell colspan="6" class="py-6 pl-0">
                <div class="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5">
                  <span class="text-sm text-gray-500">{{ labels.empty }}</span>
                  <Button variant="outline" size="sm" class="ml-3 border-white/10 bg-white/[0.03] text-gray-400 hover:bg-white/[0.06] hover:text-white" @click="startAdd('')">
                    + {{ labels.add }}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </template>
        </TableBody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { useVirtualList } from '@vueuse/core'
import Sortable from 'sortablejs'
import ChannelRow from './ChannelRow.vue'
import ColorAutocomplete from '../ColorAutocomplete.vue'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

const props = defineProps({
  // The full channels array (mutated via events)
  channels: { type: Array, required: true },
  // Computed grouped channels [{ position, channels }]
  groupedChannels: { type: Array, required: true },
  // Duplicate channel numbers Set
  dupChannelNrs: { type: Set, default: () => new Set() },
  // channelStatus(ch) → 'active' | 'eos' | 'default'
  channelStatusFn: { type: Function, required: true },
  // toggleChannelStatus(ch)
  toggleChannelStatusFn: { type: Function, required: true },
  // Keyboard nav handler
  onKeydownFn: { type: Function, default: null },
  // i18n labels
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
  'reorder', // { channels: newOrder }
])

// ── Add channel form ───────────────────────────────────────────────────────
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

const { list, containerProps, wrapperProps } = useVirtualList(virtualItems, {
  itemHeight: (i) => {
    if (!virtualItems.value[i]) return 60
    const type = virtualItems.value[i].type
    if (type === 'header') return 36
    if (type === 'channel') return 60
    if (type === 'add-btn') return 36
    if (type === 'add-form') return 76
    return 60
  },
  overscan: 10,
})

// ── Flat list for row indices ──────────────────────────────────────────────
const flatChannels = computed(() =>
  props.groupedChannels.flatMap(g => g.channels)
)

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

// ── Zeile darunter einfügen (via Context Menu) ────────────────────────────
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
  if (!tbodyEl.value) return
  sortableInstance = Sortable.create(tbodyEl.value, {
    handle: '.drag-handle',
    filter: '[data-no-drag]',
    preventOnFilter: false,
    animation: 150,
    onEnd() {
      const keyToChannel = new Map(props.channels.map(c => [c.channel + '|' + c.address, c]))
      
      // virtual list causes issues for native Sortable JS because the DOM elements out of view don't exist.
      // we need to only reorder the rendered nodes that moved, relative to their neighbors.
      // For now, reconstruct based on visible DOM.
      const reordered = []
      let currentPos = ''
      for (const tr of tbodyEl.value.rows) {
        if (tr.hasAttribute('data-no-drag') && 'pos' in tr.dataset) {
          currentPos = tr.dataset.pos
        }
        const key = tr.dataset.chKey
        if (key && keyToChannel.has(key)) {
          const ch = keyToChannel.get(key)
          ch.position = currentPos
          reordered.push(ch)
          keyToChannel.delete(key) // remove processed
        }
      }
      
      // append the ones that were not in the DOM (not rendered by virtual scrolling)
      // Note: this approach has limitations if sorting across far boundaries.
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
