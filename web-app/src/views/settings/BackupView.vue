<template>
  <div class="divide-y divide-white/10">

    <!-- Backup herunterladen -->
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-white">{{ t('settings.backup') }}</h2>
        <p class="mt-1 text-sm/6 text-gray-400">{{ t('settings.backup.hint') }}</p>
      </div>
      <div class="md:col-span-2 flex items-start">
        <button
          type="button"
          @click="downloadBackup"
          class="rounded-md px-3 py-2 text-sm font-semibold text-gray-300 ring-1 ring-white/10 hover:ring-white/20"
        >
          {{ t('settings.backup.download') }}
        </button>
      </div>
    </div>

    <!-- Backup wiederherstellen -->
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-white">{{ t('settings.backup.restore') }}</h2>
        <p class="mt-1 text-sm/6 text-gray-400">{{ t('settings.backup.restore.hint') }}</p>
      </div>
      <div class="md:col-span-2 sm:max-w-xl">
        <div class="flex items-center gap-3">
          <label class="rounded-md px-3 py-2 text-sm font-semibold text-gray-300 ring-1 ring-white/10 hover:ring-white/20 cursor-pointer">
            {{ t('settings.backup.restore.choose') }}
            <input type="file" accept=".zip" class="sr-only" @change="onRestoreFile" />
          </label>
          <span v-if="restoreFile" class="text-sm text-gray-400 truncate max-w-xs">{{ restoreFile.name }}</span>
        </div>
        <div class="mt-4" v-if="restoreFile">
          <button
            type="button"
            :disabled="restoreLoading"
            @click="doRestore"
            class="rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
          >
            {{ restoreLoading ? '…' : t('settings.backup.restore.submit') }}
          </button>
        </div>
        <p v-if="restoreMsg" :class="restoreMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'" class="mt-3 text-sm">{{ restoreMsg }}</p>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useLocale } from '../../composables/useLocale.js'
import { downloadBackup, uploadRestore } from '../../api/backup.js'

const { t } = useLocale()

const restoreFile = ref(null)
const restoreLoading = ref(false)
const restoreMsg = ref('')

function onRestoreFile(e) {
  restoreFile.value = e.target.files[0] || null
  restoreMsg.value = ''
}

async function doRestore() {
  if (!restoreFile.value) return
  if (!confirm(t('settings.backup.restore.confirm'))) return
  restoreLoading.value = true
  restoreMsg.value = ''
  try {
    await uploadRestore(restoreFile.value)
    restoreMsg.value = t('settings.backup.restore.success')
    restoreFile.value = null
  } catch (e) {
    restoreMsg.value = t('settings.backup.restore.error', { message: e.message })
  } finally {
    restoreLoading.value = false
  }
}
</script>
