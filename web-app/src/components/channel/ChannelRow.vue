<template>
  <ContextMenu>
    <ContextMenuTrigger as-child>
      <TableRow
        :data-ch-key="ch.channel + '|' + ch.address"
        :data-ch-pos="ch.position"
        :data-nav-row="rowIndex"
        class="border-t border-border group/row hover:bg-muted/30 transition-colors"
      >
        <!-- Drag handle -->
        <TableCell class="w-8 py-0 pl-1 pr-0 align-middle">
          <div class="drag-handle no-print cursor-grab active:cursor-grabbing flex items-center justify-center size-6 rounded text-muted-foreground/30 group-hover/row:text-muted-foreground hover:bg-muted transition-colors">
            <GripVertical class="size-3.5" />
          </div>
        </TableCell>

        <!-- Channel number + address -->
        <TableCell class="py-1.5 pr-4 pl-0 align-middle">
          <div class="flex items-center gap-1.5">
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
              class="bg-background/50 border border-border/40 hover:border-border focus-visible:bg-background focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring text-lg font-bold font-mono px-1.5 py-0 w-[5.5ch] text-center shadow-sm h-8 transition-colors cursor-pointer"
            />
            <span class="text-muted-foreground/30 font-mono text-sm select-none">/</span>
            <Input
              v-model="ch.address"
              @focus="emit('recordFocus')"
              @input="emit('change')"
              @blur="emit('commitFocus')"
              @click.stop
              class="bg-background/50 border border-border/40 hover:border-border focus-visible:bg-background focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring text-xs text-muted-foreground px-1.5 py-0 w-[8ch] text-center shadow-sm h-8 transition-colors"
            />
          </div>
        </TableCell>

        <!-- Color -->
        <TableCell class="px-4 py-2 align-middle">
          <ColorAutocomplete
            :modelValue="ch.color"
            @update:modelValue="emit('pushSnapshot'); ch.color = $event; emit('change')"
            :placeholder="colorPlaceholder"
            :inputAttrs="{ 'data-nav-row': rowIndex, 'data-nav-col': 1 }"
            @keydown="onKeydownCol1"
          />
        </TableCell>

          <!-- Device -->
          <TableCell class="px-3 py-2 align-middle">
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

        <!-- Notes -->
        <TableCell class="px-3 py-2 align-middle">
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

        <!-- Delete -->
        <TableCell class="w-10 pl-1 pr-1 align-middle text-center">
          <Button
            variant="ghost"
            size="icon"
            class="no-print size-7 text-muted-foreground opacity-0 group-hover/row:opacity-100 hover:bg-red-500/10 hover:text-red-400 transition-all"
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
</script>
