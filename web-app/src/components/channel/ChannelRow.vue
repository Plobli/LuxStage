<template>
  <ContextMenu>
    <ContextMenuTrigger as-child>
      <TableRow
        :data-ch-key="stableRowKey"
        :data-ch-pos="ch.position"
        :data-nav-row="rowIndex"
        class="group/row border-t border-border/60 bg-card transition-colors"
      >
        <TableCell class="w-8 py-0 pl-1 pr-0 align-middle">
          <div class="drag-handle no-print flex size-6 cursor-grab items-center justify-center rounded-sm text-muted-foreground/70 opacity-0 transition-all active:cursor-grabbing group-hover/row:opacity-100 hover:bg-muted/40">
            <GripVertical class="size-3.5" />
          </div>
        </TableCell>

        <TableCell class="py-0 pr-0 pl-0 align-middle border-l border-border/40 h-full">
          <div class="grid h-full min-h-10 grid-cols-[5.5ch_auto_8ch] items-stretch">
            <Input
              v-model="ch.channel"
              @focus="emit('recordFocus')"
              @input="emit('change')"
              @blur="emit('commitFocus')"
              :data-nav-row="rowIndex"
              data-nav-col="0"
              @keydown="onKeydownCol0"
              @click.stop="emit('toggleStatus', ch)"
              :title="ch.channel ? 'Status umschalten' : ''"
              :class="[
                dupChannelNrs.has(ch.channel) ? 'ring-1 ring-yellow-400/60' : '',
                channelStatusClass,
              ]"
              class="h-full min-h-10 w-full self-stretch cursor-pointer rounded-none border-0 bg-transparent px-2 py-0 text-center font-mono text-base font-semibold shadow-none transition-colors placeholder:text-muted-foreground/30 focus-visible:ring-0"
            />
            <span class="select-none self-stretch flex items-center justify-center font-mono text-sm text-muted-foreground/30">/</span>
            <Input
              v-model="ch.address"
              @focus="emit('recordFocus')"
              @input="emit('change')"
              @blur="emit('commitFocus')"
              @click.stop
              class="h-full min-h-10 w-full self-stretch rounded-none border-0 bg-transparent px-2 py-0 text-center text-xs text-muted-foreground shadow-none placeholder:text-muted-foreground/25 focus-visible:ring-0"
            />
          </div>
        </TableCell>

        <TableCell class="px-0 py-0 align-middle border-l border-border/40 h-full">
          <ColorAutocomplete
            :modelValue="ch.color"
            @update:modelValue="emit('pushSnapshot'); ch.color = $event; emit('change')"
            :placeholder="colorPlaceholder"
            :inputAttrs="{ 'data-nav-row': rowIndex, 'data-nav-col': 1 }"
            @keydown="onKeydownCol1"
          />
        </TableCell>

        <TableCell class="px-0 py-0 align-middle border-l border-border/40 h-full">
          <ChannelTextarea
            v-model="ch.device"
            :data-nav-row="rowIndex"
            data-nav-col="2"
            @focus="emit('recordFocus')"
            @input="emit('change')"
            @blur="emit('commitFocus')"
            @keydown="onKeydownCol2"
          />
        </TableCell>

        <TableCell class="px-0 py-0 align-middle border-l border-border/40 h-full">
          <ChannelTextarea
            v-model="ch.notes"
            :data-nav-row="rowIndex"
            data-nav-col="3"
            @focus="emit('recordFocus')"
            @input="emit('change')"
            @blur="emit('commitFocus')"
            @keydown="onKeydownCol3"
          />
        </TableCell>

        <TableCell class="w-10 pl-1 pr-1 align-middle text-center border-l border-border/40">
          <Button
            variant="ghost"
            size="icon"
            class="no-print size-7 rounded-sm text-muted-foreground opacity-0 transition-all group-hover/row:opacity-100 hover:bg-red-500/10 hover:text-red-400"
            @click="emit('delete', ch)"
            :title="deleteTitle"
          >
            <X class="size-3.5" />
          </Button>
        </TableCell>
      </TableRow>
    </ContextMenuTrigger>

    <ContextMenuContent>
      <ContextMenuItem @select="emit('insertAfter', ch)">
        <Plus class="size-4 mr-2 text-muted-foreground" />
        Zeile darunter einfügen
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem class="text-red-400 focus:text-red-300 focus:bg-red-950/40" @select="emit('delete', ch)">
        <X class="size-4 mr-2" />
        {{ deleteTitle || 'Löschen' }}
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
</template>

<script setup>
import { computed } from 'vue'
import { GripVertical, X, Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TableRow, TableCell } from '@/components/ui/table'
import ColorAutocomplete from '../ColorAutocomplete.vue'
import ChannelTextarea from './ChannelTextarea.vue'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu/index.js'

const props = defineProps({
  ch: { type: Object, required: true },
  rowIndex: { type: Number, required: true },
  dupChannelNrs: { type: Set, default: () => new Set() },
  channelStatus: { type: String, default: 'default' }, // 'active' | 'eos' | 'default'
  colorPlaceholder: { type: String, default: '' },
  deleteTitle: { type: String, default: '' },
  onKeydownFn: { type: Function, default: null },
  onAddRow: { type: Function, default: null },
})

const emit = defineEmits([
  'change',
  'recordFocus',
  'commitFocus',
  'pushSnapshot',
  'toggleStatus',
  'delete',
  'insertAfter',
])

function onKeydownCol0(e) { props.onKeydownFn?.(e, props.rowIndex, 0, 4, props.onAddRow) }
function onKeydownCol1(e) { props.onKeydownFn?.(e, props.rowIndex, 1, 4, null) }
function onKeydownCol2(e) { props.onKeydownFn?.(e, props.rowIndex, 2, 4, null) }
function onKeydownCol3(e) { props.onKeydownFn?.(e, props.rowIndex, 3, 4, props.onAddRow) }

const channelStatusClass = computed(() => {
  if (props.channelStatus === 'active') return 'text-green-400'
  if (props.channelStatus === 'eos') return 'text-amber-400'
  return 'text-foreground'
})

const stableRowKey = computed(() => {
  if (props.ch?.__rowKey) return props.ch.__rowKey
  return `${props.ch?.channel || ''}|${props.ch?.address || ''}`
})
</script>
