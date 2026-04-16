<template>
  <div class="divide-y divide-border">
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-foreground">{{ t('settings.server') }}</h2>
        <p class="mt-1 text-sm/6 text-muted-foreground">{{ t('settings.server_url.label') }}</p>
      </div>
      <div class="md:col-span-2 space-y-6 sm:max-w-xl">
        <div class="space-y-2">
          <Label for="server-url">{{ t('settings.server_url') }}</Label>
          <Input
            id="server-url"
            v-model="serverUrl"
            type="url"
            :placeholder="t('settings.server_url.placeholder')"
            @change="applyServer"
          />
        </div>
        <dl class="divide-y divide-border text-sm/6">
          <div class="py-3 flex justify-between">
            <dt class="text-muted-foreground">{{ t('settings.status.version.app') }}</dt>
            <dd class="text-foreground">{{ appVersion }}</dd>
          </div>
          <div class="py-3 flex justify-between">
            <dt class="text-muted-foreground">{{ t('settings.status.version.server') }}</dt>
            <dd>
              <span v-if="status" class="text-foreground">{{ status.version }}</span>
              <Alert v-else-if="statusError" variant="destructive" class="py-1 px-2 text-xs h-auto">
                <AlertDescription>{{ t('error.network') }}</AlertDescription>
              </Alert>
              <span v-else class="text-muted-foreground">…</span>
            </dd>
          </div>
          <div v-if="status" class="py-3 flex justify-between">
            <dt class="text-muted-foreground">{{ t('settings.status.disk') }}</dt>
            <dd class="text-foreground">{{ status.diskFree }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
