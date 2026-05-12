<template>
  <div
        :data-ch-key="stableRowKey"
        :data-ch-pos="ch.position"
        :data-nav-row="rowIndex"
        :class="isMobile
          ? `border-t border-border/60 ${rowIndex % 2 === 0 ? 'bg-card' : 'bg-muted/40'}`
          : 'group/row grid border-t border-border/60 bg-card transition-colors'
              + ' grid-cols-[2rem_10rem_7rem_minmax(14rem,22%)_1fr_7rem_2.5rem] items-center'"
      >
        <!-- Desktop: Drag handle -->
        <div v-if="!isMobile" class="flex py-0 pl-1 pr-0 align-middle">
          <div class="drag-handle no-print flex size-6 cursor-grab items-center justify-center rounded-sm text-muted-foreground/70 opacity-0 transition-all active:cursor-grabbing group-hover/row:opacity-100 hover:bg-muted/40">
            <GripVertical class="size-3.5" />
          </div>
        </div>

        <!-- Desktop: Kanal -->
        <div v-if="!isMobile" class="py-0 pr-0 pl-0 align-middle border-l border-border/40 h-full flex items-center">
          <div class="grid h-full min-h-14 w-full grid-cols-[8ch_auto_7ch] items-stretch">
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
              :class="[dupChannelNrs.has(ch.channel) ? 'ring-1 ring-yellow-400/60' : '', channelStatusClass]"
              class="h-full min-h-14 w-full self-stretch cursor-pointer rounded-none border-0 bg-transparent px-1 py-0 text-center font-mono text-xl font-semibold shadow-none transition-colors placeholder:text-muted-foreground/30 focus-visible:ring-0"
            />
            <span class="flex w-3 select-none items-center justify-center self-stretch font-mono text-sm text-muted-foreground/30">/</span>
            <Input
              v-model="ch.address"
              @focus="emit('recordFocus')"
              @input="emit('change')"
              @blur="emit('commitFocus')"
              @click.stop
              class="h-full min-h-14 w-full self-stretch rounded-none border-0 bg-transparent px-1 py-0 text-center text-xs text-muted-foreground shadow-none placeholder:text-muted-foreground/25 focus-visible:ring-0"
            />
          </div>
        </div>

        <!-- Desktop: Farbe -->
        <div v-if="!isMobile" class="px-0 py-0 align-middle border-l border-border/40 h-full flex items-center">
          <ColorAutocomplete
            :modelValue="ch.color"
            @update:modelValue="emit('pushSnapshot'); ch.color = $event; emit('change')"
            :placeholder="colorPlaceholder"
            :inputAttrs="{ 'data-nav-row': rowIndex, 'data-nav-col': 1 }"
            @keydown="onKeydownCol1"
          />
        </div>

        <!-- Desktop: Gerät -->
        <div v-if="!isMobile" class="px-0 py-0 align-middle border-l border-border/40 h-full flex items-center">
          <ChannelTextarea
            v-model="ch.device"
            :data-nav-row="rowIndex"
            data-nav-col="2"
            @focus="emit('recordFocus')"
            @input="emit('change')"
            @blur="emit('commitFocus')"
            @keydown="onKeydownCol2"
          />
        </div>

        <!-- Desktop: Notizen -->
        <div v-if="!isMobile" class="px-0 py-0 align-middle border-l border-border/40 h-full flex flex-col items-start justify-center">
          <ChannelTextarea
            v-model="ch.notes"
            :data-nav-row="rowIndex"
            data-nav-col="3"
            @focus="emit('recordFocus')"
            @input="emit('change')"
            @blur="emit('commitFocus')"
            @keydown="onKeydownCol3"
          />
          <div v-if="mountRefLabel" class="px-2 pb-1 w-full">
            <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-accent/10 text-accent/80 border border-accent/20 select-none">
              <Layers class="size-2.5 shrink-0" />{{ mountRefLabel }}
            </span>
          </div>
        </div>

        <!-- Desktop: Assign dropdown -->
        <div v-if="!isMobile" class="pl-1 pr-1 align-middle border-l border-border/40 flex items-center justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="ghost"
                size="sm"
                class="no-print h-7 rounded-sm px-2 text-[11px] text-muted-foreground opacity-0 transition-all group-hover/row:opacity-100 hover:bg-muted/60 hover:text-foreground"
              >
                <MapPin class="size-3 mr-1" />Zuweisen
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-52">
              <DropdownMenuItem @click="emit('placeInFloorplan', ch)">
                <MapPin class="size-3.5 mr-2 shrink-0" />Im Grundriss platzieren
              </DropdownMenuItem>
              <DropdownMenuItem @click="emit('assignTower', ch)">
                <TowerControl class="size-3.5 mr-2 shrink-0" />Gassenturm-Slot zuweisen
              </DropdownMenuItem>
              <DropdownMenuItem @click="emit('assignBar', ch)">
                <AlignJustify class="size-3.5 mr-2 shrink-0" />Zugstange zuweisen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <!-- Desktop: Delete -->
        <div v-if="!isMobile" class="w-10 pl-1 pr-1 align-middle text-center border-l border-border/40 flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            class="no-print size-7 rounded-sm text-muted-foreground opacity-0 transition-all group-hover/row:opacity-100 hover:bg-red-500/10 hover:text-red-400"
            @click="deleteDialogOpen = true"
            :title="deleteTitle"
          >
            <X class="size-3.5" />
          </Button>
        </div>

        <!-- Delete confirm dialog -->
        <AlertDialog :open="deleteDialogOpen" @update:open="val => { if (!val) deleteDialogOpen = false }">
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Was soll passieren?</AlertDialogTitle>
              <AlertDialogDescription>Zeile löschen entfernt den Kanal vollständig. Leeren entfernt nur Beschreibung und Farbe.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter class="flex-col sm:flex-row gap-2">
              <AlertDialogCancel @click="deleteDialogOpen = false">Abbrechen</AlertDialogCancel>
              <Button variant="outline" @click="() => { deleteDialogOpen = false; emit('clear', ch) }">Kanal leeren</Button>
              <AlertDialogAction class="bg-destructive text-destructive-foreground hover:bg-destructive/90" @click="() => { deleteDialogOpen = false; emit('delete', ch) }">Zeile löschen</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <!-- Mobile: Compact stacked layout -->
        <div v-if="isMobile" class="flex flex-col gap-0 py-0 px-0 w-full">
          <!-- Row 1: Channel / Address | Color -->
          <div class="flex gap-2 items-center px-3 py-1.5 border-l-2 border-l-border/40">
            <div class="flex items-center gap-0.5 flex-1">
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
                :class="[dupChannelNrs.has(ch.channel) ? 'ring-1 ring-yellow-400/60' : '', channelStatusClass]"
                class="w-12 h-8 cursor-pointer rounded border-0 bg-transparent px-1 py-0 text-center font-mono text-base font-semibold shadow-none transition-colors placeholder:text-muted-foreground/30 focus-visible:ring-0"
              />
              <span class="text-xs text-muted-foreground/40">/</span>
              <Input
                v-model="ch.address"
                @focus="emit('recordFocus')"
                @input="emit('change')"
                @blur="emit('commitFocus')"
                @click.stop
                class="w-16 h-8 rounded border-0 bg-transparent px-1 py-0 text-center text-xs text-muted-foreground shadow-none placeholder:text-muted-foreground/25 focus-visible:ring-0"
              />
            </div>
            <div class="shrink-0 w-28">
              <ColorAutocomplete
                :modelValue="ch.color"
                @update:modelValue="emit('pushSnapshot'); ch.color = $event; emit('change')"
                :placeholder="colorPlaceholder"
                :inputAttrs="{ 'data-nav-row': rowIndex, 'data-nav-col': 1 }"
                @keydown="onKeydownCol1"
              />
            </div>
          </div>
          <!-- Row 2: Device -->
          <div class="text-xs px-3 py-1.5 border-t border-t-border/30 border-l-2 border-l-border/40 flex items-center">
            <ChannelTextarea
              v-model="ch.device"
              :data-nav-row="rowIndex"
              data-nav-col="2"
              @focus="emit('recordFocus')"
              @input="emit('change')"
              @blur="emit('commitFocus')"
              @keydown="onKeydownCol2"
            />
          </div>
          <!-- Row 3: Notes -->
          <div class="text-xs px-3 py-1.5 border-t border-t-border/30 border-l-2 border-l-border/40 flex items-center">
            <ChannelTextarea
              v-model="ch.notes"
              :data-nav-row="rowIndex"
              data-nav-col="3"
              @focus="emit('recordFocus')"
              @input="emit('change')"
              @blur="emit('commitFocus')"
              @keydown="onKeydownCol3"
            />
          </div>
        </div>
      </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { GripVertical, X, Layers, MapPin, AlignJustify, TowerControl } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import ColorAutocomplete from '../ColorAutocomplete.vue'
import ChannelTextarea from './ChannelTextarea.vue'
import { useIsMobile } from '@/composables/useBreakpoint.js'

const props = defineProps({
  ch: { type: Object, required: true },
  rowIndex: { type: Number, required: true },
  dupChannelNrs: { type: Set, default: () => new Set() },
  channelStatus: { type: String, default: 'default' },
  colorPlaceholder: { type: String, default: '' },
  deleteTitle: { type: String, default: '' },
  onKeydownFn: { type: Function, default: null },
  onAddRow: { type: Function, default: null },
})

const emit = defineEmits([
  'change', 'recordFocus', 'commitFocus', 'pushSnapshot',
  'toggleStatus', 'delete', 'clear',
  'placeInFloorplan', 'assignTower', 'assignBar',
])

const deleteDialogOpen = ref(false)

const isMobile = useIsMobile()

function onKeydownCol0(e) { props.onKeydownFn?.(e, props.rowIndex, 0, 4, props.onAddRow) }
function onKeydownCol1(e) { props.onKeydownFn?.(e, props.rowIndex, 1, 4, null) }
function onKeydownCol2(e) { props.onKeydownFn?.(e, props.rowIndex, 2, 4, null) }
function onKeydownCol3(e) { props.onKeydownFn?.(e, props.rowIndex, 3, 4, props.onAddRow) }

const mountRefLabel = computed(() => {
  const raw = props.ch?.mount_ref
  if (!raw) return null
  try {
    const ref = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (ref?.type === 'tower') {
      const parts = [ref.towerName, ref.slotIndex != null ? `Slot ${ref.slotIndex}` : null].filter(Boolean)
      return parts.join(' · ') || 'Gassenturm'
    }
    if (ref?.type === 'bar') return ref.barName ?? 'Zugstange'
    if (ref?.type === 'stage_object') return ref.objectName ?? 'Kulisse'
  } catch { return null }
  return null
})

const channelStatusClass = computed(() => {
  if (props.channelStatus === 'active') return 'text-green-600 dark:text-green-400'
  if (props.channelStatus === 'eos') return 'text-amber-400'
  return 'text-foreground'
})

const stableRowKey = computed(() => {
  if (props.ch?.__rowKey) return props.ch.__rowKey
  return `${props.ch?.channel || ''}|${props.ch?.address || ''}`
})
</script>
