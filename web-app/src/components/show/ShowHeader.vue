<template>
  <div class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-border bg-background px-4 sm:px-6 lg:px-8">
    <Button variant="ghost" size="icon" class="text-muted-foreground hover:text-foreground" @click="emit('back')">
      <span class="sr-only">{{ labels.back }}</span>
      <ArrowLeft class="size-5" />
    </Button>
    <Separator orientation="vertical" class="h-6" />

    <!-- Tab-Switcher -->
    <div class="flex mr-2">
      <Tabs :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" class="w-auto">
        <TabsList class="bg-muted/50 p-1 h-8">
          <TabsTrigger value="channels" class="text-xs px-3 py-1">
            {{ labels.tabChannels }}
          </TabsTrigger>
          <TabsTrigger value="info" class="text-xs px-3 py-1">
            {{ labels.tabInfo }}
          </TabsTrigger>
          <TabsTrigger value="floorplan" class="text-xs px-3 py-1">
            {{ labels.tabFloorplan }}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>

    <div class="flex min-w-0 flex-1 items-center gap-x-3">
      <h1 class="text-sm font-semibold text-foreground truncate">{{ showName }}</h1>
      <span class="hidden sm:block text-xs text-muted-foreground shrink-0">{{ showDate }}</span>
      <!-- Undo/Redo -->
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              :disabled="!canUndo"
              class="no-print h-8 w-8 text-muted-foreground hover:text-foreground"
              @click="emit('undo')"
            >
              <Undo2 class="size-4" />
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
              class="no-print h-8 w-8 text-muted-foreground hover:text-foreground"
              @click="emit('redo')"
            >
              <Redo2 class="size-4" />
              <span class="sr-only">{{ labels.redo }}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{{ labels.redo }}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <span v-if="saving" class="text-xs text-muted-foreground shrink-0">…</span>
    </div>

    <!-- Right side -->
    <div class="flex items-center gap-x-3 shrink-0">
      <!-- Presence: aktive Nutzer -->
      <div v-if="presence.length > 1" class="flex items-center -space-x-1.5">
        <div
          v-for="u in presence.slice(0, 4)"
          :key="u.username"
          :title="u.username + (u.devices.includes('ios') ? ' (iOS)' : '')"
          class="size-6 rounded-full bg-muted ring-2 ring-background flex items-center justify-center text-[10px] font-semibold text-foreground uppercase"
        >{{ u.username[0] }}</div>
        <div v-if="presence.length > 4" class="size-6 rounded-full bg-muted ring-2 ring-background flex items-center justify-center text-[9px] text-muted-foreground">+{{ presence.length - 4 }}</div>
      </div>
      <Badge v-if="dupAddressWarning" variant="outline" class="text-yellow-400 border-yellow-500/30 bg-yellow-500/10 text-xs">
        <AlertTriangle class="size-3 mr-1" />{{ labels.dupAddress }}
      </Badge>
      <Badge v-if="dupChannelWarning" variant="outline" class="text-yellow-400 border-yellow-500/30 bg-yellow-500/10 text-xs">
        <AlertTriangle class="size-3 mr-1" />{{ labels.dupChannel }}
      </Badge>
      <div class="relative">
        <Input
          :value="search"
          @input="emit('update:search', $event.target.value)"
          type="search"
          :placeholder="labels.search"
          class="h-9 w-44 md:w-56 xl:w-72 pl-9"
        />
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
      </div>
    </div>

    <Separator orientation="vertical" class="h-6 shrink-0" />

    <!-- Buttons -->
    <div class="no-print flex items-center gap-x-2 shrink-0">
      <!-- Verlauf -->
      <Button variant="outline" size="sm" class="text-muted-foreground hover:text-foreground" @click="emit('openHistory')">{{ labels.history }}</Button>

      <!-- Importieren Dropdown -->
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

      <!-- Exportieren Dropdown -->
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

    <!-- Hidden file inputs -->
    <input ref="eosFileInput" type="file" accept=".csv" class="hidden" @change="emit('eosFileSelected', $event)" />
    <input ref="csvImportInput" type="file" accept=".csv" class="hidden" @change="emit('csvFileSelected', $event)" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Search, Undo2, Redo2, ArrowLeft, ChevronDown, AlertTriangle } from 'lucide-vue-next'
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

defineProps({
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
      tabChannels: 'Kanäle', tabInfo: 'Info', tabFloorplan: 'Grundriss',
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
</script>
