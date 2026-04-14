<template>
  <div class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-white/10 bg-gray-950 px-4 sm:px-6 lg:px-8">
    <button type="button" class="text-gray-400 hover:text-white" @click="emit('back')">
      <span class="sr-only">{{ labels.back }}</span>
      <svg class="size-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clip-rule="evenodd" /></svg>
    </button>
    <div class="h-6 w-px bg-white/10" aria-hidden="true"></div>

    <!-- Tab-Switcher -->
    <div class="flex gap-1 mr-2">
      <button
        :class="modelValue === 'channels' ? 'bg-white/10 text-white' : 'text-gray-400'"
        class="rounded px-2 py-1 text-xs font-medium"
        @click="emit('update:modelValue', 'channels')"
      >{{ labels.tabChannels }}</button>
      <button
        :class="modelValue === 'info' ? 'bg-white/10 text-white' : 'text-gray-400'"
        class="rounded px-2 py-1 text-xs font-medium"
        @click="emit('update:modelValue', 'info')"
      >{{ labels.tabInfo }}</button>
      <button
        :class="modelValue === 'floorplan' ? 'bg-white/10 text-white' : 'text-gray-400'"
        class="rounded px-2 py-1 text-xs font-medium"
        @click="emit('update:modelValue', 'floorplan')"
      >{{ labels.tabFloorplan }}</button>
    </div>

    <div class="flex min-w-0 flex-1 items-center gap-x-3">
      <h1 class="text-sm font-semibold text-white truncate">{{ showName }}</h1>
      <span class="hidden sm:block text-xs text-gray-500 shrink-0">{{ showDate }}</span>
      <!-- Undo/Redo -->
      <button
        type="button"
        :disabled="!canUndo"
        :class="canUndo ? 'text-gray-400 hover:text-white' : 'opacity-30 cursor-not-allowed pointer-events-none'"
        class="no-print p-1"
        :title="labels.undo"
        @click="emit('undo')"
      >
        <ArrowUturnLeftIcon class="size-4" />
      </button>
      <button
        type="button"
        :disabled="!canRedo"
        :class="canRedo ? 'text-gray-400 hover:text-white' : 'opacity-30 cursor-not-allowed pointer-events-none'"
        class="no-print p-1"
        :title="labels.redo"
        @click="emit('redo')"
      >
        <ArrowUturnRightIcon class="size-4" />
      </button>
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
      <div class="grid grid-cols-1">
        <input
          :value="search"
          @input="emit('update:search', $event.target.value)"
          type="search"
          :placeholder="labels.search"
          class="col-start-1 row-start-1 block w-28 xl:w-48 bg-white/5 py-1.5 pr-3 pl-9 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent rounded-md placeholder:text-gray-500"
        />
        <MagnifyingGlassIcon class="pointer-events-none col-start-1 row-start-1 ml-3 size-4 self-center text-gray-400" aria-hidden="true" />
      </div>
    </div>

    <div class="h-6 w-px bg-white/10 shrink-0" aria-hidden="true"></div>

    <!-- Buttons -->
    <div class="no-print flex items-center gap-x-2 shrink-0">
      <!-- Verlauf -->
      <button type="button" class="rounded-md px-2 py-1.5 text-sm font-semibold text-gray-400 ring-1 ring-white/10 hover:ring-white/20" @click="emit('openHistory')">{{ labels.history }}</button>

      <!-- Importieren Dropdown -->
      <div class="relative">
        <button
          type="button"
          :class="menuOpen === 'import' ? 'ring-white/30 text-white' : 'ring-white/10 text-gray-400'"
          class="rounded-md px-2 py-1.5 text-sm font-semibold ring-1 hover:ring-white/30 flex items-center gap-1"
          @click="menuOpen = menuOpen === 'import' ? null : 'import'"
        >
          {{ labels.import }}
          <svg class="size-3 opacity-50" viewBox="0 0 12 12" fill="currentColor"><path d="M6 8L1 3h10z"/></svg>
        </button>
        <div
          v-if="menuOpen === 'import'"
          class="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg bg-gray-950 ring-1 ring-white/15 shadow-2xl overflow-hidden"
        >
          <button class="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-white/8" @click="eosFileInput?.click(); menuOpen = null">{{ labels.eosImport }}</button>
          <div class="border-t border-white/10" />
          <button class="w-full text-left px-4 py-2.5 text-sm text-gray-500 hover:bg-white/8" @click="csvImportInput?.click(); menuOpen = null">{{ labels.csvImport }}</button>
        </div>
      </div>

      <!-- Exportieren Dropdown -->
      <div class="relative">
        <button
          type="button"
          :class="menuOpen === 'export' ? 'ring-white/30 text-white' : 'ring-white/10 text-gray-400'"
          class="rounded-md px-2 py-1.5 text-sm font-semibold ring-1 hover:ring-white/30 flex items-center gap-1"
          @click="menuOpen = menuOpen === 'export' ? null : 'export'"
        >
          {{ labels.export }}
          <svg class="size-3 opacity-50" viewBox="0 0 12 12" fill="currentColor"><path d="M6 8L1 3h10z"/></svg>
        </button>
        <div
          v-if="menuOpen === 'export'"
          class="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg bg-gray-950 ring-1 ring-white/15 shadow-2xl overflow-hidden"
          @click="menuOpen = null"
        >
          <button class="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-white/8" @click="emit('openPdf')">{{ labels.pdf }}</button>
          <div class="border-t border-white/10" />
          <button class="w-full text-left px-4 py-2.5 text-sm text-gray-500 hover:bg-white/8" @click="emit('downloadCsv')">{{ labels.csvExport }}</button>
        </div>
      </div>
    </div>

    <!-- Klick außerhalb schließt Dropdown -->
    <div v-if="menuOpen" class="fixed inset-0 z-40" @click="menuOpen = null" />

    <!-- Hidden file inputs -->
    <input ref="eosFileInput" type="file" accept=".csv" class="hidden" @change="emit('eosFileSelected', $event)" />
    <input ref="csvImportInput" type="file" accept=".csv" class="hidden" @change="emit('csvFileSelected', $event)" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { MagnifyingGlassIcon } from '@heroicons/vue/20/solid'
import { ArrowUturnLeftIcon, ArrowUturnRightIcon } from '@heroicons/vue/24/outline'

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

const menuOpen = ref(null)
const eosFileInput = ref(null)
const csvImportInput = ref(null)
</script>
