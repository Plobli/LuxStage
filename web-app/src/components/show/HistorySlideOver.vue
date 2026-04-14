<template>
  <Transition
    enter-active-class="transition-transform duration-300 ease-out"
    enter-from-class="translate-x-full"
    enter-to-class="translate-x-0"
    leave-active-class="transition-transform duration-200 ease-in"
    leave-from-class="translate-x-0"
    leave-to-class="translate-x-full"
  >
    <div
      v-if="open"
      class="fixed inset-y-0 right-0 z-50 w-96 bg-gray-900 border-l border-white/10 flex flex-col shadow-2xl no-print"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <div class="flex items-center gap-2">
          <button
            v-if="currentEntry"
            type="button"
            class="text-xs text-gray-400 hover:text-white"
            @click="currentEntry = null"
          >
            {{ labels.back }}
          </button>
          <h2 class="text-sm font-semibold text-white">{{ labels.title }}</h2>
        </div>
        <button type="button" class="text-gray-400 hover:text-white" @click="emit('close')">
          <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex-1 flex items-center justify-center text-gray-500 text-sm">
        …
      </div>

      <!-- Snapshot list -->
      <div v-else-if="!currentEntry" class="flex-1 overflow-y-auto">
        <p v-if="entries.length === 0" class="px-4 py-6 text-sm text-gray-500">{{ labels.empty }}</p>
        <button
          v-for="entry in entries"
          :key="entry.id"
          type="button"
          class="w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors"
          @click="loadEntry(entry.id)"
        >
          <p class="text-sm text-white">{{ new Date(entry.created_at).toLocaleString() }}</p>
        </button>
      </div>

      <!-- Snapshot detail -->
      <div v-else class="flex-1 flex flex-col overflow-hidden">
        <div class="px-4 py-2 border-b border-white/5 shrink-0">
          <p class="text-xs text-gray-400">{{ new Date(currentEntry.created_at).toLocaleString() }}</p>
          <p class="text-xs text-gray-500 mt-0.5">{{ labels.channelCount(currentEntry.channels?.length ?? 0) }}</p>
        </div>
        <div class="flex-1 overflow-y-auto">
          <div
            v-for="ch in currentEntry.channels"
            :key="ch.id"
            class="flex items-baseline gap-3 px-4 py-2 border-b border-white/5 text-xs"
          >
            <span class="font-mono font-bold text-white w-8 shrink-0">{{ ch.channel }}</span>
            <span class="text-gray-400 truncate">{{ ch.device }}</span>
            <span class="text-gray-600 truncate ml-auto">{{ ch.notes }}</span>
          </div>
        </div>
        <div class="px-4 py-3 border-t border-white/10 shrink-0">
          <button
            type="button"
            class="w-full rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
            @click="emit('restore', currentEntry)"
          >
            {{ labels.restore }}
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Backdrop -->
  <div
    v-if="open"
    class="fixed inset-0 z-40 bg-black/40 no-print"
    @click="emit('close')"
  />
</template>

<script setup>
import { ref, watch } from 'vue'
import { fetchHistory, fetchHistoryEntry } from '../../api/shows.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  showId: { type: String, required: true },
  labels: {
    type: Object,
    default: () => ({
      title: 'Verlauf',
      back: '← Zurück',
      empty: 'Keine Snapshots',
      restore: 'Wiederherstellen',
      channelCount: (n) => `${n} Kanäle`,
    }),
  },
})

const emit = defineEmits(['close', 'restore'])

const loading = ref(false)
const entries = ref([])
const currentEntry = ref(null)

watch(() => props.open, async (val) => {
  if (!val) { currentEntry.value = null; return }
  loading.value = true
  currentEntry.value = null
  entries.value = await fetchHistory(props.showId)
  loading.value = false
})

async function loadEntry(id) {
  loading.value = true
  currentEntry.value = await fetchHistoryEntry(props.showId, id)
  loading.value = false
}
</script>
