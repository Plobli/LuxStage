<template>
  <div class="divide-y divide-white/10">
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-white">{{ t('settings.server') }}</h2>
        <p class="mt-1 text-sm/6 text-gray-400">{{ t('settings.server_url.label') }}</p>
      </div>
      <div class="md:col-span-2 space-y-6 sm:max-w-xl">
        <div>
          <label class="block text-sm/6 font-medium text-white mb-2">{{ t('settings.server_url') }}</label>
          <Input
            v-model="serverUrl"
            type="url"
            :placeholder="t('settings.server_url.placeholder')"
            @change="applyServer"
          />
        </div>
        <dl class="divide-y divide-white/5 text-sm/6">
          <div class="py-3 flex justify-between">
            <dt class="text-gray-400">{{ t('settings.status.version.app') }}</dt>
            <dd class="text-gray-300">{{ appVersion }}</dd>
          </div>
          <div class="py-3 flex justify-between">
            <dt class="text-gray-400">{{ t('settings.status.version.server') }}</dt>
            <dd>
              <span v-if="status" class="text-gray-300">{{ status.version }}</span>
              <span v-else-if="statusError" class="text-red-400">{{ t('error.network') }}</span>
              <span v-else class="text-gray-500">…</span>
            </dd>
          </div>
          <div v-if="status" class="py-3 flex justify-between">
            <dt class="text-gray-400">{{ t('settings.status.disk') }}</dt>
            <dd class="text-gray-300">{{ status.diskFree }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Input } from '@/components/ui/input'
import { useLocale } from '../../composables/useLocale.js'
import { setServerUrl, api } from '../../api/client.js'

const { t } = useLocale()

/* global __APP_VERSION__ */
const appVersion = __APP_VERSION__
const serverUrl = ref(localStorage.getItem('server_url') || 'http://localhost:3000')
const status = ref(null)
const statusError = ref('')

onMounted(async () => {
  try {
    status.value = await api.get('/api/status')
  } catch {
    statusError.value = t('error.network')
  }
})

function applyServer() {
  setServerUrl(serverUrl.value)
}
</script>
