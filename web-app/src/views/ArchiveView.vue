<template>
  <div class="px-4 py-10 sm:px-6 lg:px-8">
    <div class="border-b border-white/5 pb-5 mb-6">
      <h2 class="text-base/7 font-semibold text-white">{{ t('nav.archive') }}</h2>
    </div>

    <div v-if="loading" class="text-sm text-gray-400">…</div>

    <div v-else-if="shows.length === 0" class="text-sm text-gray-500">
      {{ t('show.archive.empty') }}
    </div>

    <ul v-else role="list" class="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
      <li
        v-for="show in shows"
        :key="show.id"
        class="col-span-1 flex rounded-md shadow-xs"
      >
        <div class="flex w-16 shrink-0 items-center justify-center rounded-l-md bg-gray-800 text-sm font-medium text-white">
          {{ initials(show.name || show.id) }}
        </div>
        <div class="flex flex-1 items-center justify-between truncate rounded-r-md border-t border-r border-b border-white/10 bg-gray-800/50">
          <div class="flex-1 truncate px-4 py-2 text-sm">
            <span class="font-medium text-white">{{ show.name || show.id }}</span>
            <p class="text-gray-400">{{ show.datum }}</p>
          </div>
          <div class="shrink-0 pr-2">
            <button
              type="button"
              class="inline-flex size-8 items-center justify-center rounded-full text-gray-400 hover:text-white focus:outline-none"
              @click="restore(show.id)"
              :title="t('show.restore')"
            >
              <ArrowUturnLeftIcon class="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ArrowUturnLeftIcon } from '@heroicons/vue/24/outline'
import { fetchArchivedShows, restoreShow } from '../api/shows.js'
import { useLocale } from '../composables/useLocale.js'

const { t } = useLocale()

const shows = ref([])
const loading = ref(true)

function initials(name) {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

onMounted(async () => {
  try {
    shows.value = await fetchArchivedShows()
  } finally {
    loading.value = false
  }
})

async function restore(id) {
  await restoreShow(id)
  shows.value = shows.value.filter(s => s.id !== id)
}
</script>
