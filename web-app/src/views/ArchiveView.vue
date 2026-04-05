<template>
  <div class="px-4 py-10 sm:px-6 lg:px-8">
    <div class="border-b border-white/5 pb-5 mb-6">
      <h2 class="text-base/7 font-semibold text-white">{{ t('nav.archive') }}</h2>
    </div>

    <!-- Bestätigungsdialog Löschen -->
    <div v-if="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/80">
      <div class="bg-gray-900 rounded-xl border border-white/10 p-6 max-w-sm w-full mx-4">
        <h3 class="text-base font-semibold text-white mb-2">{{ t('show.delete.confirm.title') }}</h3>
        <p class="text-sm text-gray-400 mb-6">{{ t('show.delete.confirm.text', { name: deleteTarget.name || deleteTarget.id }) }}</p>
        <div class="flex justify-end gap-3">
          <button
            type="button"
            class="rounded-md px-3 py-2 text-sm font-semibold text-gray-400 ring-1 ring-white/10 hover:ring-white/20"
            @click="deleteTarget = null"
          >{{ t('action.cancel') }}</button>
          <button
            type="button"
            class="rounded-md px-3 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-500"
            @click="deletePermanent"
          >{{ t('show.delete') }}</button>
        </div>
      </div>
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
          <div class="shrink-0 pr-2 flex">
            <button
              type="button"
              class="inline-flex size-8 items-center justify-center rounded-full text-gray-400 hover:text-white focus:outline-none"
              @click="restore(show.id)"
              :title="t('show.restore')"
            >
              <ArrowUturnLeftIcon class="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="inline-flex size-8 items-center justify-center rounded-full text-gray-400 hover:text-red-400 focus:outline-none"
              @click="confirmDelete(show)"
              :title="t('show.delete')"
            >
              <TrashIcon class="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ArrowUturnLeftIcon, TrashIcon } from '@heroicons/vue/24/outline'
import { fetchArchivedShows, restoreShow, deleteShowPermanent } from '../api/shows.js'
import { useLocale } from '../composables/useLocale.js'

const { t } = useLocale()

const shows = ref([])
const loading = ref(true)
const deleteTarget = ref(null)

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

function confirmDelete(show) {
  deleteTarget.value = show
}

async function deletePermanent() {
  const id = deleteTarget.value.id
  deleteTarget.value = null
  await deleteShowPermanent(id)
  shows.value = shows.value.filter(s => s.id !== id)
}
</script>
