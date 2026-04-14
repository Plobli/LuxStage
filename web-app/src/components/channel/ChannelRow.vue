<template>
  <tr
    :data-ch-key="ch.channel + '|' + ch.address"
    :data-ch-pos="ch.position"
    :data-nav-row="rowIndex"
    class="border-t border-white/5 group/row hover:bg-white/[0.03] transition-colors align-middle"
  >
    <!-- Drag handle -->
    <td class="py-2 pr-0 pl-0 align-middle w-4">
      <div class="drag-handle no-print cursor-grab active:cursor-grabbing px-1 text-gray-400 hover:text-gray-200 transition-colors">
        <svg class="size-4" viewBox="0 0 20 20" fill="currentColor"><path d="M7 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM7 10a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM7 16a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM13 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM13 10a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM13 16a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>
      </div>
    </td>

    <!-- Channel number + address -->
    <td class="py-2 pr-3 pl-0 align-middle">
      <div
        class="flex flex-col items-center gap-1 cursor-pointer select-none"
        @click.stop="emit('toggleStatus', ch)"
      >
        <input
          v-model="ch.channel"
          @focus="emit('recordFocus')"
          @input="emit('change')"
          @blur="emit('commitFocus')"
          :data-nav-row="rowIndex"
          data-nav-col="0"
          @keydown="onKeydownCol0"
          :class="[dupChannelNrs.has(ch.channel) ? 'ring-1 ring-yellow-400/60 rounded' : '', channelStatusClass]"
          class="bg-transparent focus:bg-white/5 focus:outline-none focus:ring-0 text-2xl font-bold font-mono px-0 border-0 leading-none w-[4ch] text-center"
        />
        <input
          v-model="ch.address"
          @focus="emit('recordFocus')"
          @input="emit('change')"
          @blur="emit('commitFocus')"
          class="bg-transparent focus:bg-white/5 focus:outline-none focus:ring-0 text-xs text-gray-500 px-0 border-0 w-[5ch] text-center"
        />
      </div>
    </td>

    <!-- Color -->
    <td class="px-3 py-2 align-middle">
      <ColorAutocomplete
        :modelValue="ch.color"
        @update:modelValue="emit('pushSnapshot'); ch.color = $event; emit('change')"
        :placeholder="colorPlaceholder"
        :inputAttrs="{ 'data-nav-row': rowIndex, 'data-nav-col': 1 }"
        @keydown="onKeydownCol1"
      />
    </td>

    <!-- Device -->
    <td class="px-3 py-0 align-middle">
      <ChannelTextarea
        v-model="ch.device"
        :data-nav-row="rowIndex"
        data-nav-col="2"
        @focus="emit('recordFocus')"
        @input="emit('change')"
        @blur="emit('commitFocus')"
        @keydown="onKeydownCol2"
      />
    </td>

    <!-- Notes -->
    <td class="px-3 py-0 align-middle">
      <ChannelTextarea
        v-model="ch.notes"
        :data-nav-row="rowIndex"
        data-nav-col="3"
        @focus="emit('recordFocus')"
        @input="emit('change')"
        @blur="emit('commitFocus')"
        @keydown="onKeydownCol3"
      />
    </td>

    <!-- Delete -->
    <td class="pl-2 pr-1" style="vertical-align: middle; text-align: center;">
      <button
        class="no-print text-gray-400 hover:text-red-400 transition-colors"
        @click="emit('delete', ch)"
        :title="deleteTitle"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
      </button>
    </td>
  </tr>
</template>

<script setup>
import { computed } from 'vue'
import ColorAutocomplete from '../ColorAutocomplete.vue'
import ChannelTextarea from './ChannelTextarea.vue'

const props = defineProps({
  ch: { type: Object, required: true },
  rowIndex: { type: Number, required: true },
  dupChannelNrs: { type: Set, default: () => new Set() },
  channelStatus: { type: String, default: 'default' }, // 'active' | 'eos' | 'default'
  colorPlaceholder: { type: String, default: '' },
  deleteTitle: { type: String, default: '' },
  // onKeydown(e, row, col, totalCols, addFn) — same signature as useKeyboardNav
  onKeydownFn: { type: Function, default: null },
  // called when Tab-out of last col (col 3) or channel col (col 0)
  onAddRow: { type: Function, default: null },
})

const emit = defineEmits([
  'change',
  'recordFocus',
  'commitFocus',
  'pushSnapshot',
  'toggleStatus',
  'delete',
])

function onKeydownCol0(e) { props.onKeydownFn?.(e, props.rowIndex, 0, 4, props.onAddRow) }
function onKeydownCol1(e) { props.onKeydownFn?.(e, props.rowIndex, 1, 4, null) }
function onKeydownCol2(e) { props.onKeydownFn?.(e, props.rowIndex, 2, 4, null) }
function onKeydownCol3(e) { props.onKeydownFn?.(e, props.rowIndex, 3, 4, props.onAddRow) }

const channelStatusClass = computed(() => {
  if (props.channelStatus === 'active') return 'text-green-400'
  if (props.channelStatus === 'eos') return 'text-amber-400'
  return 'text-gray-400'
})
</script>
