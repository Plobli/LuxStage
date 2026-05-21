<template>
  <div class="sticky top-0 z-40 border-b border-border" style="background: hsl(240 10% 6%)">
    <div class="flex h-14 shrink-0 items-center gap-x-3 px-4 sm:px-6 lg:px-8">
      <!-- Titel + Datum -->
      <div class="flex items-baseline gap-x-2 shrink-0 min-w-0">
        <h1
          v-if="!editingName"
          class="text-xl font-semibold text-foreground truncate max-w-50 cursor-text hover:text-foreground/70 transition-colors"
          @click="startEditName"
        >{{ showName }}</h1>
        <input
          v-else
          ref="nameInput"
          :value="editName"
          @input="editName = $event.target.value"
          @blur="commitName"
          @keydown.enter.prevent="commitName"
          @keydown.esc.prevent="cancelName"
          class="text-xl font-semibold text-foreground bg-transparent border-b border-accent outline-none max-w-50 min-w-20"
        />
        <span v-if="showDate" class="text-xs text-muted-foreground shrink-0 hidden sm:inline">{{ showDate }}</span>
      </div>

      <!-- Undo/Redo + Saving -->
      <div class="hidden sm:flex items-center gap-x-1 shrink-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" :disabled="!canUndo" class="no-print h-8 w-8 text-muted-foreground" @click="emit('undo')">
                <Undo2 class="size-4" />
                <span class="sr-only">{{ labels.undo }}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>{{ labels.undo }}</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" :disabled="!canRedo" class="no-print h-8 w-8 text-muted-foreground" @click="emit('redo')">
                <Redo2 class="size-4" />
                <span class="sr-only">{{ labels.redo }}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>{{ labels.redo }}</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span v-if="saving" class="text-xs text-muted-foreground">…</span>
      </div>

      <div class="flex-1" />

      <!-- Presence -->
      <div v-if="presenceWithActivity.length > 1" class="hidden sm:flex items-center -space-x-1.5 shrink-0">
        <TooltipProvider>
          <Tooltip v-for="u in presenceWithActivity.slice(0, 4)" :key="u.username">
            <TooltipTrigger asChild>
              <div
                :style="{ backgroundColor: userColor(u.username) }"
                :class="{ 'ring-2 ring-green-400/80': u.isActive }"
                class="size-6 rounded-full ring-2 ring-background flex items-center justify-center text-[10px] font-semibold text-white uppercase relative transition-all"
              >
                {{ u.username[0] }}
                <div v-if="u.isActive" class="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-green-400 ring-1 ring-background" />
                <span v-if="u.devices.includes('ios')" class="absolute -top-0.5 -right-0.5 text-xs">📱</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <div class="text-sm">
                <p class="font-semibold">{{ u.username }}</p>
                <p class="text-xs text-muted-foreground">
                  {{ u.devices.includes('ios') ? 'iOS' : 'Web' }}{{ u.devices.length > 1 ? ' + ' + (u.devices.length - 1) : '' }}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div v-if="presenceWithActivity.length > 4" class="size-6 rounded-full bg-muted ring-2 ring-background flex items-center justify-center text-[9px] text-muted-foreground">+{{ presenceWithActivity.length - 4 }}</div>
      </div>

      <!-- Warnings -->
      <Badge v-if="dupAddressWarning" variant="outline" class="text-yellow-400 border-yellow-500/30 bg-yellow-500/10 text-xs hidden sm:flex shrink-0">
        <AlertTriangle class="size-3 mr-1" />{{ labels.dupAddress }}
      </Badge>
      <Badge v-if="dupChannelWarning" variant="outline" class="text-yellow-400 border-yellow-500/30 bg-yellow-500/10 text-xs hidden sm:flex shrink-0">
        <AlertTriangle class="size-3 mr-1" />{{ labels.dupChannel }}
      </Badge>

      <!-- Health Badge -->
      <ShowHealthBadge
        v-if="healthLabels && activeTab === 'channels'"
        :noNotes="healthStats.noNotes"
        :noDevice="healthStats.noDevice"
        :noPosition="healthStats.noPosition"
        :noAddress="healthStats.noAddress"
        :activeFilter="activeHealthFilter"
        :labels="healthLabels"
        @filterNoNotes="emit('healthFilter', 'noNotes')"
        @filterNoDevice="emit('healthFilter', 'noDevice')"
        @filterNoPosition="emit('healthFilter', 'noPosition')"
        @filterNoAddress="emit('healthFilter', 'noAddress')"
        @clearFilter="emit('healthFilter', null)"
      />

      <!-- Search: nur im Kanäle-Tab -->
      <div v-if="activeTab === 'channels'" class="relative shrink-0">
        <Input
          :value="search"
          @input="emit('update:search', $event.target.value)"
          @keydown.esc="emit('update:search', '')"
          type="search"
          :placeholder="labels.search"
          class="h-8 w-48 xl:w-56 pl-8 text-xs"
        />
        <Search class="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" aria-hidden="true" />
      </div>

      <!-- Desktop Actions -->
      <div class="no-print hidden lg:flex items-center gap-x-2 shrink-0">
        <Button variant="ghost" size="sm" class="text-muted-foreground gap-1.5" @click="emit('openHistory')">
          <History class="size-3.5" />
          {{ labels.history }}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" class="text-muted-foreground hover:text-foreground flex items-center gap-1">
              {{ labels.import }}
              <ChevronDown class="size-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-56">
            <DropdownMenuItem class="cursor-pointer" @click="eosFileInput?.click()">
              {{ labels.eosImport }}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem class="cursor-pointer text-muted-foreground" @click="csvImportInput?.click()">
              {{ labels.csvImport }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" class="text-muted-foreground hover:text-foreground flex items-center gap-1">
              {{ labels.export }}
              <ChevronDown class="size-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-56">
            <DropdownMenuItem class="cursor-pointer" @click="emit('openPdf')">
              {{ labels.pdf }}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem class="cursor-pointer text-muted-foreground" @click="emit('downloadCsv')">
              {{ labels.csvExport }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <!-- Mobile Menu -->
      <div class="lg:hidden flex items-center shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" class="text-muted-foreground">
              <MoreVertical class="size-5" />
              <span class="sr-only">{{ t('show.header.menu_open') }}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-48">
            <DropdownMenuItem class="cursor-pointer" @click="emit('openHistory')">
              {{ labels.history }}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem class="cursor-pointer" @click="eosFileInput?.click()">
              {{ labels.eosImport }}
            </DropdownMenuItem>
            <DropdownMenuItem class="cursor-pointer text-muted-foreground" @click="csvImportInput?.click()">
              {{ labels.csvImport }}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem class="cursor-pointer" @click="emit('openPdf')">
              {{ labels.pdf }}
            </DropdownMenuItem>
            <DropdownMenuItem class="cursor-pointer text-muted-foreground" @click="emit('downloadCsv')">
              {{ labels.csvExport }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </div>

  <!-- Hidden file inputs -->
  <input ref="eosFileInput" type="file" accept=".csv" class="hidden" @change="emit('eosFileSelected', $event)" />
  <input ref="csvImportInput" type="file" accept=".csv" class="hidden" @change="emit('csvFileSelected', $event)" />
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { useLocale } from '@/composables/useLocale.js'
const { t } = useLocale()
import { Search, Undo2, Redo2, ChevronDown, AlertTriangle, MoreVertical, History } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import ShowHealthBadge from './ShowHealthBadge.vue'

const props = defineProps({
  activeTab: { type: String, default: 'gassenturm' },
  showName: { type: String, default: '' },
  showDate: { type: String, default: '' },
  canUndo: { type: Boolean, default: false },
  canRedo: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  presence: { type: Array, default: () => [] },
  dupAddressWarning: { type: Boolean, default: false },
  dupChannelWarning: { type: Boolean, default: false },
  search: { type: String, default: '' },
  healthStats: {
    type: Object,
    default: () => ({ noNotes: 0, noDevice: 0, noPosition: 0, noAddress: 0 }),
  },
  healthLabels: { type: Object, default: null },
  activeHealthFilter: { type: String, default: null },
  labels: {
    type: Object,
    default: () => ({
      back: 'Zurück',
      tabChannels: 'Kanäle', tabInfo: 'Info', tabPhotos: 'Fotos', tabFloorplan: 'Grundriss',
      undo: 'Rückgängig', redo: 'Wiederholen',
      dupAddress: 'Doppelte Adresse', dupChannel: 'Doppelter Kanal',
      search: 'In Kanälen suchen …',
      history: 'Verlauf',
      import: 'Importieren', export: 'Exportieren',
      eosImport: 'EOS importieren', csvImport: 'CSV importieren',
      pdf: 'PDF', csvExport: 'CSV exportieren',
    }),
  },
})

const emit = defineEmits([
  'update:search',
  'update:showName',
  'undo',
  'redo',
  'openHistory',
  'openPdf',
  'downloadCsv',
  'eosFileSelected',
  'csvFileSelected',
  'healthFilter',
])

const eosFileInput = ref(null)
const csvImportInput = ref(null)

const editingName = ref(false)
const editName = ref('')
const nameInput = ref(null)

async function startEditName() {
  editName.value = props.showName
  editingName.value = true
  await nextTick()
  nameInput.value?.focus()
  nameInput.value?.select()
}

function commitName() {
  const trimmed = editName.value.trim()
  if (trimmed && trimmed !== props.showName) {
    emit('update:showName', trimmed)
  }
  editingName.value = false
}

function cancelName() {
  editingName.value = false
}

const colorMap = ['#3b82f6', '#a855f7', '#22c55e', '#f97316', '#ec4899', '#14b8a6', '#6366f1', '#06b6d4']

function userColor(username) {
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = ((hash << 5) - hash) + username.charCodeAt(i)
    hash |= 0
  }
  return colorMap[Math.abs(hash) % colorMap.length]
}

const presenceWithActivity = computed(() => {
  return props.presence.map(u => ({
    ...u,
    isActive: u.lastActivityAt && Date.now() - new Date(u.lastActivityAt).getTime() < 30000
  }))
})
</script>
