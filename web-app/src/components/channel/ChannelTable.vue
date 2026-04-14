<template>
  <table class="min-w-full overflow-x-auto">
    <colgroup>
      <col class="w-4" />
      <col class="w-24" />
      <col class="w-20" />
      <col class="w-[30ch]" />
      <col />
      <col class="w-6" />
    </colgroup>
    <thead class="sticky top-16 z-10 bg-gray-950">
      <tr class="border-b border-white/10">
        <th class="w-4"></th>
        <th scope="col" class="py-3 pr-3 pl-0 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{{ labels.channel }}</th>
        <th scope="col" class="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{{ labels.color }}</th>
        <th scope="col" class="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{{ labels.device }}</th>
        <th scope="col" class="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{{ labels.notes }}</th>
        <th scope="col" class="w-6"></th>
      </tr>
    </thead>
    <tbody ref="tbodyEl">
      <template v-for="group in groupedChannels" :key="group.position">
        <!-- Group header -->
        <tr class="border-t border-white/5" data-no-drag :data-pos="group.position">
          <th colspan="6" scope="colgroup" class="py-2 pr-3 pl-0 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
            <template v-if="editingPosition === group.position">
              <input
                v-model="editingPositionValue"
                autofocus
                @blur="savePosition"
                @keydown.enter="savePosition"
                @keydown.escape="editingPosition = null"
                class="bg-transparent border-b border-accent focus:outline-none text-xs font-semibold text-white uppercase tracking-wide w-40"
              />
            </template>
            <template v-else>
              <button
                type="button"
                class="hover:text-white transition-colors"
                :title="labels.editPosition"
                @click="startEditPosition(group.position)"
              >
                {{ group.position || labels.noCategory }}
              </button>
              <span class="ml-2 font-normal normal-case text-gray-600">{{ group.channels.length }}</span>
            </template>
          </th>
        </tr>

        <!-- Channel rows -->
        <ChannelRow
          v-for="ch in group.channels"
          :key="ch.channel"
          :ch="ch"
          :rowIndex="rowIndexOf(ch)"
          :dupChannelNrs="dupChannelNrs"
          :channelStatus="channelStatus(ch)"
          :colorPlaceholder="labels.color"
          :deleteTitle="labels.delete"
          :onKeydownFn="onKeydownFn"
          :onAddRow="() => startAdd(group.position)"
          @change="emit('change')"
          @recordFocus="emit('recordFocus')"
          @commitFocus="emit('commitFocus')"
          @pushSnapshot="emit('pushSnapshot')"
          @toggleStatus="toggleChannelStatus(ch)"
          @delete="emit('deleteChannel', ch)"
        />

        <!-- Add row button -->
        <tr class="no-print border-t border-white/5" data-no-drag>
          <td colspan="6" class="py-2 pl-0">
            <button type="button" class="text-sm text-gray-600 hover:text-gray-300" @click="startAdd(group.position)">+ {{ labels.add }}</button>
          </td>
        </tr>

        <!-- Add row form -->
        <tr
          v-if="addingPosition === group.position"
          class="border-t border-white/5 bg-white/5"
          data-no-drag
          @keydown.escape="addingPosition = null"
          @keydown.enter.prevent="saveAdd"
        >
          <td class="w-4"></td>
          <td class="py-2 pr-3 pl-0 align-middle">
            <div class="flex flex-col items-center gap-1">
              <input autofocus class="bg-transparent focus:outline-none text-2xl font-bold font-mono text-white px-0 border-0 leading-none w-[4ch] text-center" v-model="addForm.channel" :placeholder="labels.channelNr" />
              <input class="bg-transparent focus:outline-none text-xs text-gray-500 px-0 border-0 w-[5ch] text-center" v-model="addForm.address" :placeholder="labels.addressExample" />
            </div>
          </td>
          <td class="px-3 py-2 align-middle">
            <ColorAutocomplete v-model="addForm.color" @change="() => {}" :placeholder="labels.color" />
          </td>
          <td class="px-3 py-0 align-middle"><textarea class="bg-transparent focus:outline-none text-sm text-gray-300 w-full px-2 border-0 resize-none leading-snug [field-sizing:content] min-h-14 py-4 align-middle" v-model="addForm.device" /></td>
          <td class="px-3 py-0 align-middle"><textarea class="bg-transparent focus:outline-none text-sm text-gray-300 w-full px-2 border-0 resize-none leading-snug [field-sizing:content] min-h-14 py-4 align-middle" v-model="addForm.notes" /></td>
          <td class="py-2 pl-2 pr-0 align-middle"><button class="text-green-400 hover:text-green-300 text-sm" @click="saveAdd">✓</button></td>
        </tr>
      </template>
    </tbody>

    <!-- Empty state -->
    <tbody v-if="groupedChannels.length === 0">
      <tr v-if="addingPosition === ''" class="border-t border-white/5 bg-white/5" @keydown.escape="addingPosition = null" @keydown.enter.prevent="saveAdd">
        <td class="w-4"></td>
        <td class="py-2 pr-3 pl-0 align-middle">
          <div class="flex flex-col items-center gap-1">
            <input autofocus class="bg-transparent focus:outline-none text-2xl font-bold font-mono text-white px-0 border-0 leading-none w-[4ch] text-center" v-model="addForm.channel" :placeholder="labels.channelNr" />
            <input class="bg-transparent focus:outline-none text-xs text-gray-500 px-0 border-0 w-[5ch] text-center" v-model="addForm.address" :placeholder="labels.addressExample" />
          </div>
        </td>
        <td class="px-3 py-2 align-middle">
          <ColorAutocomplete v-model="addForm.color" @change="() => {}" :placeholder="labels.color" />
        </td>
        <td class="px-3 py-0 align-middle"><textarea class="bg-transparent focus:outline-none text-sm text-gray-300 w-full px-2 border-0 resize-none leading-snug [field-sizing:content] min-h-14 py-4 align-middle" v-model="addForm.device" /></td>
        <td class="px-3 py-0 align-middle"><textarea class="bg-transparent focus:outline-none text-sm text-gray-300 w-full px-2 border-0 resize-none leading-snug [field-sizing:content] min-h-14 py-4 align-middle" v-model="addForm.notes" /></td>
        <td class="py-2 pl-2 pr-0 align-middle"><button class="text-green-400 hover:text-green-300 text-sm" @click="saveAdd">✓</button></td>
      </tr>
      <tr v-else class="border-t border-white/5">
        <td colspan="6" class="py-4 pl-0">
          <span class="text-sm text-gray-500">{{ labels.empty }}</span>
          <button type="button" class="ml-3 text-sm text-gray-400 hover:text-white" @click="startAdd('')">+ {{ labels.add }}</button>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import Sortable from 'sortablejs'
import ChannelRow from './ChannelRow.vue'
import ColorAutocomplete from '../ColorAutocomplete.vue'

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

// ── Add channel form ───────────────────────────────────────────────────────
const addingPosition = ref(null)
const addForm = ref({})

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
