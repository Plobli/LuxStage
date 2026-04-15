<template>
  <div class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-white/10 bg-gray-950 px-4 sm:px-6 lg:px-8">
    <Button variant="ghost" size="icon" class="text-gray-400 hover:text-white" @click="emit('back')">
      <span class="sr-only">{{ labels.back }}</span>
      <svg class="size-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clip-rule="evenodd" /></svg>
    </Button>
    <div class="h-6 w-px bg-white/10" aria-hidden="true"></div>

    <!-- Tab-Switcher -->
    <div class="flex mr-2">
      <Tabs :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" class="w-auto">
        <TabsList class="bg-white/5 p-1 h-8">
          <TabsTrigger value="channels" class="text-xs px-3 py-1 data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400">
            {{ labels.tabChannels }}
          </TabsTrigger>
          <TabsTrigger value="info" class="text-xs px-3 py-1 data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400">
            {{ labels.tabInfo }}
          </TabsTrigger>
          <TabsTrigger value="floorplan" class="text-xs px-3 py-1 data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400">
            {{ labels.tabFloorplan }}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>

    <div class="flex min-w-0 flex-1 items-center gap-x-3">
      <h1 class="text-sm font-semibold text-white truncate">{{ showName }}</h1>
      <span class="hidden sm:block text-xs text-gray-500 shrink-0">{{ showDate }}</span>
      <!-- Undo/Redo -->
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              :disabled="!canUndo"
              class="no-print h-8 w-8 text-gray-400 hover:text-white"
              @click="emit('undo')"
            >
              <Undo2 class="size-4" />
              <span class="sr-only">{{ labels.undo }}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" class="bg-gray-900 border-white/10 text-white">
            <p>{{ labels.undo }}</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              :disabled="!canRedo"
              class="no-print h-8 w-8 text-gray-400 hover:text-white"
              @click="emit('redo')"
            >
              <Redo2 class="size-4" />
              <span class="sr-only">{{ labels.redo }}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" class="bg-gray-900 border-white/10 text-white">
            <p>{{ labels.redo }}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <span v-if="saving" class="text-xs text-gray-500 shrink-0">…</span>
    </div>

    <!-- Right side -->
    <div class="flex items-center gap-x-3 shrink-0">
      <!-- Presence: aktive Nutzer -->
      <div v-if="presence.length > 1" class="flex items-center -space-x-1.5">
        <div
          v-for="u in presence.slice(0, 4)"
          :key="u.username"
          :title="u.username + (u.devices.includes('ios') ? ' (iOS)' : '')"
          class="size-6 rounded-full bg-gray-700 ring-2 ring-gray-950 flex items-center justify-center text-[10px] font-semibold text-white uppercase"
        >{{ u.username[0] }}</div>
        <div v-if="presence.length > 4" class="size-6 rounded-full bg-gray-700 ring-2 ring-gray-950 flex items-center justify-center text-[9px] text-gray-400">+{{ presence.length - 4 }}</div>
      </div>
      <span v-if="dupAddressWarning" class="text-xs text-yellow-400">⚠ {{ labels.dupAddress }}</span>
      <span v-if="dupChannelWarning" class="text-xs text-yellow-400">⚠ {{ labels.dupChannel }}</span>
      <div class="relative">
        <Input
          :value="search"
          @input="emit('update:search', $event.target.value)"
          type="search"
          :placeholder="labels.search"
          class="h-9 w-44 md:w-56 xl:w-72 bg-white/[0.04] border-white/10 text-white pl-9 placeholder:text-muted-foreground hover:border-white/20 focus-visible:ring-1 focus-visible:ring-accent/60 focus-visible:bg-white/[0.06] transition-colors"
        />
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
      </div>
    </div>

    <div class="h-6 w-px bg-white/10 shrink-0" aria-hidden="true"></div>

    <!-- Buttons -->
    <div class="no-print flex items-center gap-x-2 shrink-0">
      <!-- Verlauf -->
      <Button variant="outline" size="sm" class="bg-transparent border-white/10 text-gray-400 hover:bg-transparent hover:text-white hover:border-white/20" @click="emit('openHistory')">{{ labels.history }}</Button>

      <!-- Importieren Dropdown -->
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" class="bg-transparent border-white/10 text-gray-400 hover:bg-transparent hover:text-white hover:border-white/30 data-[state=open]:border-white/30 data-[state=open]:text-white flex items-center gap-1">
            {{ labels.import }}
            <svg class="size-3 opacity-50" viewBox="0 0 12 12" fill="currentColor"><path d="M6 8L1 3h10z"/></svg>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-56 bg-gray-950 border-white/10 text-gray-200">
          <DropdownMenuItem class="cursor-pointer hover:bg-white/8 focus:bg-white/8 focus:text-white" @click="eosFileInput?.click()">
            {{ labels.eosImport }}
          </DropdownMenuItem>
          <DropdownMenuSeparator class="bg-white/10" />
          <DropdownMenuItem class="cursor-pointer text-gray-500 hover:bg-white/8 focus:bg-white/8 focus:text-white" @click="csvImportInput?.click()">
            {{ labels.csvImport }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- Exportieren Dropdown -->
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" class="bg-transparent border-white/10 text-gray-400 hover:bg-transparent hover:text-white hover:border-white/30 data-[state=open]:border-white/30 data-[state=open]:text-white flex items-center gap-1">
            {{ labels.export }}
            <svg class="size-3 opacity-50" viewBox="0 0 12 12" fill="currentColor"><path d="M6 8L1 3h10z"/></svg>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-56 bg-gray-950 border-white/10 text-gray-200">
          <DropdownMenuItem class="cursor-pointer hover:bg-white/8 focus:bg-white/8 focus:text-white" @click="emit('openPdf')">
            {{ labels.pdf }}
          </DropdownMenuItem>
          <DropdownMenuSeparator class="bg-white/10" />
          <DropdownMenuItem class="cursor-pointer text-gray-500 hover:bg-white/8 focus:bg-white/8 focus:text-white" @click="emit('downloadCsv')">
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
import { Search, Undo2, Redo2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
