<template>
  <div class="flex h-full flex-col overflow-hidden bg-card">
    <div class="shrink-0 sticky top-0 z-20 border-b border-border/90 bg-muted shadow-[0_1px_0_rgba(255,255,255,0.04),0_4px_8px_rgba(0,0,0,0.10)]">
      <div v-if="!isMobile" class="grid min-h-8 grid-cols-[2rem_10rem_7rem_minmax(14rem,22%)_minmax(16rem,1fr)_2.5rem] items-center px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground/90">
        <div></div>
        <div>{{ labels.channel }}</div>
        <div class="px-0">{{ labels.color }}</div>
        <div class="px-0">{{ labels.device }}</div>
        <div class="px-1.5">{{ labels.notes }}</div>
        <div></div>
      </div>
    </div>

    <div ref="tbodyEl" class="flex-1 min-h-0 overflow-y-auto bg-card">
      <template v-for="item in virtualItems" :key="item.id">

        <!-- Header row (group position) -->
        <div
          v-if="item.type === 'header'"
          class="border-0 bg-muted"
          data-no-drag
          :data-pos="item.group.position"
        >
          <div v-if="isMobile" class="flex items-center justify-end gap-3 px-3 py-1">
            <div class="flex min-w-0 items-center gap-2">
              <template v-if="editingPosition === item.group.position">
                <Input
                  v-model="editingPositionValue"
                  autofocus
                  @blur="savePosition"
                  @keydown.enter="savePosition"
                  @keydown.escape="editingPosition = null"
                  class="h-6 flex-1 rounded-none border-0 border-b border-primary/30 bg-transparent px-0 text-[11px] font-semibold text-foreground shadow-none focus-visible:ring-0"
                />
              </template>
              <template v-else>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-auto min-w-0 p-0 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/85 hover:bg-transparent hover:text-foreground"
                  :title="labels.editPosition"
                  @click="startEditPosition(item.group.position)"
                >{{ item.group.position || labels.noCategory }}</Button>
                <span class="shrink-0 text-[11px] text-muted-foreground/70">({{ item.group.channels.length }})</span>
              </template>
            </div>
          </div>
          <div v-else class="flex items-center justify-end gap-3 px-4 py-1">
            <div class="flex min-w-0 items-center gap-2">
              <template v-if="editingPosition === item.group.position">
                <Input
                  v-model="editingPositionValue"
                  autofocus
                  @blur="savePosition"
                  @keydown.enter="savePosition"
                  @keydown.escape="editingPosition = null"
                  class="h-6 w-80 rounded-none border-0 border-b border-primary/30 bg-transparent px-0 text-[11px] font-semibold text-foreground shadow-none focus-visible:ring-0"
                />
              </template>
              <template v-else>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-auto p-0 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/85 hover:bg-transparent hover:text-foreground"
                  :title="labels.editPosition"
                  @click="startEditPosition(item.group.position)"
                >{{ item.group.position || labels.noCategory }}</Button>
                <span class="text-[11px] text-muted-foreground/70">{{ item.group.channels.length }}</span>
              </template>
            </div>
          </div>
        </div>

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
          :allShowPhotos="allShowPhotos"
          @change="emit('change')"
          @recordFocus="emit('recordFocus')"
          @commitFocus="emit('commitFocus')"
          @pushSnapshot="emit('pushSnapshot')"
          @toggleStatus="toggleChannelStatus(item.ch)"
          @delete="emit('deleteChannel', item.ch)"
          @insertAfter="insertAfter(item.ch)"
        />

        <!-- Add button row -->
        <div
          v-else-if="item.type === 'add-btn'"
          class="border-t border-border/60 bg-card px-3 py-1.5"
          data-no-drag
        >
          <Button
            variant="ghost"
            size="sm"
            class="h-7 rounded-sm px-2 text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            @click="startAdd(item.group.position)"
          >+ {{ labels.add }}</Button>
        </div>

        <!-- Add form row -->
        <div
          v-else-if="item.type === 'add-form'"
          class="border-t border-border/60 bg-card px-3 py-1.5"
          data-no-drag
          @keydown.escape="addingPosition = null"
          @keydown.enter.prevent="saveAdd"
        >
          <!-- Mobile add form -->
          <div v-if="isMobile" class="flex flex-col gap-1.5">
            <div class="flex items-center gap-1.5">
              <Input
                autofocus
                v-model="addForm.channel"
                :placeholder="labels.channelNr"
                class="h-8 w-[5.5ch] border-0 bg-transparent px-1 py-0 text-center font-mono text-base font-semibold leading-none text-foreground shadow-none placeholder:text-muted-foreground/35 focus-visible:bg-muted/20 focus-visible:ring-0"
              />
              <span class="select-none font-mono text-sm text-muted-foreground/30">/</span>
              <Input
                v-model="addForm.address"
                :placeholder="labels.addressExample"
                class="h-8 w-[8ch] border-0 bg-transparent px-1 py-0 text-center text-xs text-muted-foreground shadow-none placeholder:text-muted-foreground/25 focus-visible:bg-muted/20 focus-visible:ring-0"
              />
              <div class="flex-1">
                <ColorAutocomplete v-model="addForm.color" @change="() => {}" :placeholder="labels.color" />
              </div>
            </div>
            <div class="flex gap-1.5">
              <Textarea
                v-model="addForm.device"
                rows="1"
                :placeholder="labels.device"
                class="h-8 min-h-8 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm leading-none text-foreground shadow-none transition-colors placeholder:text-muted-foreground/25 hover:bg-muted/10 focus-visible:bg-muted/20 focus-visible:outline-none focus-visible:ring-0"
              />
              <Textarea
                v-model="addForm.notes"
                rows="1"
                :placeholder="labels.notes"
                class="h-8 min-h-8 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm leading-none text-foreground shadow-none transition-colors placeholder:text-muted-foreground/25 hover:bg-muted/10 focus-visible:bg-muted/20 focus-visible:outline-none focus-visible:ring-0"
              />
            </div>
          </div>
          <!-- Desktop add form -->
          <div v-else class="grid grid-cols-[2rem_10rem_7rem_minmax(14rem,22%)_minmax(16rem,1fr)_2.5rem] items-center gap-0">
            <div></div>
            <div class="px-3">
              <div class="flex items-center gap-1.5">
                <Input
                  autofocus
                  v-model="addForm.channel"
                  :placeholder="labels.channelNr"
                  class="h-7 w-[5.5ch] border-0 bg-transparent px-1 py-0 text-center font-mono text-base font-semibold leading-none text-foreground shadow-none placeholder:text-muted-foreground/35 focus-visible:bg-muted/20 focus-visible:ring-0"
                />
                <span class="select-none font-mono text-sm text-muted-foreground/30">/</span>
                <Input
                  v-model="addForm.address"
                  :placeholder="labels.addressExample"
                  class="h-7 w-[8ch] border-0 bg-transparent px-1 py-0 text-center text-xs text-muted-foreground shadow-none placeholder:text-muted-foreground/25 focus-visible:bg-muted/20 focus-visible:ring-0"
                />
              </div>
            </div>
            <div class="px-2">
              <ColorAutocomplete v-model="addForm.color" @change="() => {}" :placeholder="labels.color" />
            </div>
            <div class="px-2">
              <Textarea
                v-model="addForm.device"
                rows="1"
                class="h-8 min-h-8 w-full resize-none border-0 bg-transparent px-2 py-1.5 text-sm leading-none text-foreground shadow-none transition-colors placeholder:text-muted-foreground/25 hover:bg-muted/10 focus-visible:bg-muted/20 focus-visible:outline-none focus-visible:ring-0"
              />
            </div>
            <div class="px-2">
              <Textarea
                v-model="addForm.notes"
                rows="1"
                class="h-8 min-h-8 w-full resize-none border-0 bg-transparent px-2 py-1.5 text-sm leading-none text-foreground shadow-none transition-colors placeholder:text-muted-foreground/25 hover:bg-muted/10 focus-visible:bg-muted/20 focus-visible:outline-none focus-visible:ring-0"
              />
            </div>
            <div class="flex justify-center">
              <Button
                size="icon"
                variant="ghost"
                class="size-8 rounded-sm text-green-500 hover:bg-green-500/10 hover:text-green-600"
                @click="saveAdd"
              ><Check class="size-4" /></Button>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div
          v-else-if="item.type === 'empty'"
          class="px-4 py-10"
          data-no-drag
        >
          <div class="flex flex-col items-center gap-3 rounded-md border border-dashed border-border/60 bg-muted/5 px-6 py-8">
            <p class="text-sm text-muted-foreground">{{ labels.empty }}</p>
            <Button
              variant="ghost"
              size="sm"
              class="h-8 rounded-sm border border-border/50 px-3 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              @click="startAdd('')"
            >+ {{ labels.add }}</Button>
          </div>
        </div>

      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { useIsMobile } from '@/composables/useBreakpoint.js'
import { Check } from 'lucide-vue-next'
import Sortable from 'sortablejs'
import ChannelRow from './ChannelRow.vue'
import ColorAutocomplete from '../ColorAutocomplete.vue'
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
  allShowPhotos: { type: Array, default: () => [] },
  labels: {
    type: Object,
    default: () => ({
      channel: 'Kanal', color: 'Farbe', device: 'Gerät', notes: 'Notizen',
      editPosition: 'Bearbeiten', noCategory: '–', add: 'Kanal hinzufügen',
      delete: 'Löschen', empty: 'Keine Kanäle', channelNr: 'Nr', addressExample: 'z.B. 1',
    }),
  },
})

const isMobile = useIsMobile()

const emit = defineEmits([
  'change',
  'recordFocus',
  'commitFocus',
  'pushSnapshot',
  'deleteChannel',
  'reorder',
])

let channelRowUid = 0
function ensureStableChannelKey(ch) {
  if (!ch) return ''
  if (!Object.prototype.hasOwnProperty.call(ch, '__rowKey')) {
    Object.defineProperty(ch, '__rowKey', {
      value: `row-${channelRowUid++}`,
      enumerable: false,
      configurable: true,
      writable: false,
    })
  }
  return ch.__rowKey
}

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
      items.push({ id: ensureStableChannelKey(ch), type: 'channel', ch, group })
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
  ensureStableChannelKey(newCh)
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
  ensureStableChannelKey(newCh)
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
      const keyToChannel = new Map(props.channels.map(c => [ensureStableChannelKey(c), c]))
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
        if (keyToChannel.has(ensureStableChannelKey(ch))) {
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
