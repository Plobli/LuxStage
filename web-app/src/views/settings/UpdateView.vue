<template>
  <div class="divide-y divide-white/10">
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-white">{{ t('settings.update') }}</h2>
        <p class="mt-1 text-sm/6 text-gray-400">{{ t('settings.update.hint') }}</p>
      </div>
      <div class="md:col-span-2 space-y-4 sm:max-w-xl">
        <div class="flex items-center gap-3">
          <label class="text-sm text-gray-400 shrink-0">{{ t('settings.update.branch') }}</label>
          <select
            v-model="selectedBranch"
            @change="onBranchChange"
            class="rounded-md bg-white/5 px-2 py-1 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent"
          >
            <option v-for="b in availableBranches" :key="b" :value="b">{{ b }}</option>
          </select>
        </div>
        <div class="text-sm">
          <span v-if="checkLoading" class="text-gray-400">{{ t('settings.update.checking') }}</span>
          <span v-else-if="checkResult?.available" class="text-amber-400 font-medium">
            ↑ {{ t('settings.update.available', { commits: checkResult.commits }) }}
          </span>
          <span v-else-if="checkResult && !checkResult.available" class="text-green-400">
            ✓ {{ t('settings.update.uptodate') }}
          </span>
          <span v-else-if="checkError" class="text-gray-500">{{ t('settings.update.check_failed') }}</span>
        </div>
        <pre v-if="checkResult?.log" class="text-xs text-gray-400 bg-white/5 rounded-md px-3 py-2 whitespace-pre-wrap font-mono">{{ checkResult.log }}</pre>
        <div>
          <button
            type="button"
            :disabled="updating || !checkResult?.available"
            @click="doUpdate"
            class="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {{ updating ? '…' : t('settings.update.run') }}
          </button>
        </div>
        <p v-if="updateMsg" :class="updateError ? 'text-red-400' : 'text-green-400'" class="text-sm">{{ updateMsg }}</p>
        <pre v-if="updateLog.length" class="text-xs text-gray-500 bg-white/5 rounded-md px-3 py-2 whitespace-pre-wrap font-mono">{{ updateLog.join('\n') }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useLocale } from '../../composables/useLocale.js'
import { api } from '../../api/client.js'
import { updateAvailable } from '../../composables/useUpdateCheck.js'

const { t } = useLocale()

const updating = ref(false)
const updateMsg = ref('')
const updateError = ref(false)
const updateLog = ref([])
const checkLoading = ref(false)
const checkResult = ref(null)
const checkError = ref(false)
const selectedBranch = ref('main')
const availableBranches = ref(['main'])

async function loadBranches() {
  try {
    const { branches } = await api.get('/api/update/branches')
    if (branches?.length) availableBranches.value = branches
  } catch { /* ignore */ }
}

function onBranchChange() {
  checkResult.value = null
  checkForUpdate()
}

async function checkForUpdate() {
  checkLoading.value = true
  checkResult.value = null
  checkError.value = false
  try {
    checkResult.value = await api.get(`/api/update/check?branch=${encodeURIComponent(selectedBranch.value)}`)
  } catch {
    checkError.value = true
  } finally {
    checkLoading.value = false
  }
}

async function doUpdate() {
  updating.value = true
  updateMsg.value = ''
  updateError.value = false
  updateLog.value = []
  try {
    const result = await api.post('/api/update', { branch: selectedBranch.value })
    updateLog.value = result?.log ?? []
    updateMsg.value = t('settings.update.success')
    checkResult.value = null
    updateAvailable.value = false
  } catch (e) {
    updateError.value = true
    const msg = e.message || ''
    updateMsg.value = msg.includes('wiederhergestellt') || msg.includes('restored')
      ? t('settings.update.rollback')
      : t('settings.update.error', { message: msg })
    checkForUpdate()
  } finally {
    updating.value = false
  }
}

onMounted(() => { loadBranches(); checkForUpdate() })
</script>
