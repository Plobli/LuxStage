<template>
  <div class="sticky top-0 z-40 flex flex-col border-b border-border bg-background">
    <!-- Erste Zeile: Back, Tabs, Menu/Actions -->
    <div class="flex h-16 shrink-0 items-center gap-x-4 px-4 sm:px-6 lg:px-8">
      <Button variant="ghost" size="icon" class="text-muted-foreground hover:text-foreground shrink-0" @click="emit('back')">
        <span class="sr-only">{{ labels.back }}</span>
        <ArrowLeft class="size-5" />
      </Button>
      <Separator orientation="vertical" class="h-6" />

      <!-- Tab-Switcher: wächst automatisch, wird kompakt auf Mobile -->
      <div class="flex flex-1 min-w-0">
        <Tabs :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" class="w-auto">
          <TabsList class="bg-muted h-10 p-1 gap-0.5">
            <TabsTrigger value="channels" class="text-xs sm:text-sm px-2 sm:px-4 py-1.5 font-medium">
              {{ labels.tabChannels }}
            </TabsTrigger>
            <TabsTrigger value="info" class="text-xs sm:text-sm px-2 sm:px-4 py-1.5 font-medium">
              {{ labels.tabInfo }}
            </TabsTrigger>
            <TabsTrigger value="photos" class="text-xs sm:text-sm px-2 sm:px-4 py-1.5 font-medium">
              {{ labels.tabPhotos }}
            </TabsTrigger>
            <TabsTrigger value="floorplan" class="text-xs sm:text-sm px-2 sm:px-4 py-1.5 font-medium">
              {{ labels.tabFloorplan }}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <!-- Spacer -->
      <div class="flex-1 hidden sm:block" />

      <!-- Desktop Actions -->
      <div class="no-print hidden lg:flex items-center gap-x-2 shrink-0">
        <Button variant="outline" size="sm" class="text-muted-foreground hover:text-foreground" @click="emit('openHistory')">{{ labels.history }}</Button>
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

      <!-- Mobile Menu (Punkte) -->
      <div class="lg:hidden flex items-center shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" class="text-muted-foreground hover:text-foreground">
              <MoreVertical class="size-5" />
              <span class="sr-only">Menü öffnen</span>
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

    <!-- Zweite Zeile: Info/Metadata (Mobile und Desktop) -->
    <div class="flex h-10 items-center gap-x-3 px-4 sm:px-6 lg:px-8 bg-muted/50 border-t border-border/50">
      <!-- Title + Date -->
      <h1 class="text-xs sm:text-sm font-semibold text-foreground truncate">{{ showName }}</h1>
      <span class="text-xs text-muted-foreground shrink-0">{{ showDate }}</span>

      <!-- Spacer -->
      <div class="flex-1" />

      <!-- Presence: aktive Nutzer (hidden auf sehr kleinen Screens) -->
      <div v-if="presenceWithActivity.length > 1" class="hidden sm:flex items-center -space-x-1.5">
        <TooltipProvider>
          <Tooltip v-for="u in presenceWithActivity.slice(0, 4)" :key="u.username">
            <TooltipTrigger asChild>
              <div
                :style="{ backgroundColor: userColor(u.username) }"
                :class="{ 'ring-2 ring-green-400/80': u.isActive }"
                class="size-5 sm:size-6 rounded-full ring-2 ring-background flex items-center justify-center text-[8px] sm:text-[10px] font-semibold text-white uppercase relative transition-all"
              >
                {{ u.username[0] }}
                <div v-if="u.isActive" class="absolute -bottom-0.5 -right-0.5 size-2 sm:size-2.5 rounded-full bg-green-400 ring-1 ring-background" />
                <span v-if="u.devices.includes('ios')" class="absolute -top-0.5 -right-0.5 text-[8px] sm:text-xs">📱</span>
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
        <div v-if="presenceWithActivity.length > 4" class="size-5 sm:size-6 rounded-full bg-muted ring-2 ring-background flex items-center justify-center text-[8px] sm:text-[9px] text-muted-foreground">+{{ presenceWithActivity.length - 4 }}</div>
      </div>

      <!-- Warnings -->
      <Badge v-if="dupAddressWarning" variant="outline" class="text-yellow-400 border-yellow-500/30 bg-yellow-500/10 text-xs hidden sm:flex">
        <AlertTriangle class="size-3 mr-1" />{{ labels.dupAddress }}
      </Badge>
      <Badge v-if="dupChannelWarning" variant="outline" class="text-yellow-400 border-yellow-500/30 bg-yellow-500/10 text-xs hidden sm:flex">
        <AlertTriangle class="size-3 mr-1" />{{ labels.dupChannel }}
      </Badge>

      <!-- Undo/Redo -->
      <TooltipProvider class="hidden sm:flex">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              :disabled="!canUndo"
              class="no-print h-6 sm:h-8 w-6 sm:w-8 text-muted-foreground hover:text-foreground"
              @click="emit('undo')"
            >
              <Undo2 class="size-3 sm:size-4" />
              <span class="sr-only">{{ labels.undo }}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{{ labels.undo }}</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              :disabled="!canRedo"
              class="no-print h-6 sm:h-8 w-6 sm:w-8 text-muted-foreground hover:text-foreground"
              @click="emit('redo')"
            >
              <Redo2 class="size-3 sm:size-4" />
              <span class="sr-only">{{ labels.redo }}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{{ labels.redo }}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <span v-if="saving" class="text-xs text-muted-foreground shrink-0">…</span>

      <!-- Search -->
      <div class="relative">
        <Input
          :value="search"
          @input="emit('update:search', $event.target.value)"
          type="search"
          :placeholder="labels.search"
          class="h-8 w-48 xl:w-56 pl-8 text-xs"
        />
        <Search class="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" aria-hidden="true" />
      </div>
    </div>
  </div>

  <!-- Hidden file inputs -->
  <input ref="eosFileInput" type="file" accept=".csv" class="hidden" @change="emit('eosFileSelected', $event)" />
  <input ref="csvImportInput" type="file" accept=".csv" class="hidden" @change="emit('csvFileSelected', $event)" />
</template>

<script setup>
import { ref, computed } from 'vue'
import { Search, Undo2, Redo2, ArrowLeft, ChevronDown, AlertTriangle, MoreVertical } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

const props = defineProps({
  modelValue: { type: String, default: 'channels' }, // active tab
  showName: { type: String, default: '' },
  showDate: { type: String, default: '' },
  canUndo: { type: Boolean, default: false },
  canRedo: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  presence: { type: Array, default: () => [] },
  dupAddressWarning: { type: Boolean, default: false },
  dupChannelWarning: { type: Boolean, default: false },
  search: { type: String, default: '' },
  labels: {
    type: Object,
    default: () => ({
      back: 'Zurück',
      tabChannels: 'Kanäle', tabInfo: 'Info', tabPhotos: 'Fotos', tabFloorplan: 'Grundriss',
      undo: 'Rückgängig', redo: 'Wiederholen',
      dupAddress: 'Doppelte Adresse', dupChannel: 'Doppelter Kanal',
      search: 'Suchen',
      history: 'Verlauf',
      import: 'Importieren', export: 'Exportieren',
      eosImport: 'EOS importieren', csvImport: 'CSV importieren',
      pdf: 'PDF', csvExport: 'CSV exportieren',
    }),
  },
})

const emit = defineEmits([
  'update:modelValue',  // tab change
  'update:search',
  'back',
  'undo',
  'redo',
  'openHistory',
  'openPdf',
  'downloadCsv',
  'eosFileSelected',
  'csvFileSelected',
])

const eosFileInput = ref(null)
const csvImportInput = ref(null)

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
