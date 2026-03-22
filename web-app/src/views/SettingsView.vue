<template>
  <div class="px-4 py-10 sm:px-6 lg:px-8">
    <div class="mb-8">
      <h1 class="text-base font-semibold text-white">{{ t('nav.settings') }}</h1>
    </div>

    <div class="space-y-10 divide-y divide-white/10">

      <!-- Sprache -->
      <div class="grid grid-cols-1 gap-x-8 gap-y-8 pt-10 md:grid-cols-3 first:pt-0">
        <div>
          <SectionHeading :text="t('settings.language')" />
        </div>
        <div class="bg-gray-800/50 ring-1 ring-white/10 rounded-xl md:col-span-2">
          <div class="px-4 py-6 sm:p-8 flex gap-6">
            <label class="flex items-center gap-2 text-sm text-white cursor-pointer">
              <input type="radio" :checked="locale === 'de'" value="de" @change="setLocale('de')" class="accent-accent" />
              {{ t('settings.language.de') }}
            </label>
            <label class="flex items-center gap-2 text-sm text-white cursor-pointer">
              <input type="radio" :checked="locale === 'en'" value="en" @change="setLocale('en')" class="accent-accent" />
              {{ t('settings.language.en') }}
            </label>
          </div>
        </div>
      </div>

      <!-- Server-URL -->
      <div class="grid grid-cols-1 gap-x-8 gap-y-8 pt-10 md:grid-cols-3">
        <div>
          <SectionHeading :text="t('settings.server')" />
        </div>
        <div class="bg-gray-800/50 ring-1 ring-white/10 rounded-xl md:col-span-2">
          <div class="px-4 py-6 sm:p-8 space-y-4">
            <div>
              <label class="block text-sm/6 font-medium text-white">{{ t('settings.server_url.label') }}</label>
              <div class="mt-2">
                <input
                  v-model="serverUrl"
                  type="url"
                  :placeholder="t('settings.server_url.placeholder')"
                  @change="applyServer"
                  class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent"
                />
              </div>
            </div>
            <div v-if="status" class="divide-y divide-white/10 text-sm">
              <div class="flex justify-between py-2">
                <span class="text-gray-400">{{ t('settings.status.version') }}</span>
                <span class="text-white">{{ status.version }}</span>
              </div>
              <div class="flex justify-between py-2">
                <span class="text-gray-400">{{ t('settings.status.disk') }}</span>
                <span class="text-white">{{ status.diskFree }}</span>
              </div>
            </div>
            <p v-else-if="statusError" class="text-sm text-red-400">{{ statusError }}</p>
            <p v-else class="text-sm text-gray-500">{{ t('error.loading') }}</p>
          </div>
        </div>
      </div>

      <!-- Backup -->
      <div class="grid grid-cols-1 gap-x-8 gap-y-8 pt-10 md:grid-cols-3">
        <div>
          <SectionHeading :text="t('settings.backup')" />
        </div>
        <div class="bg-gray-800/50 ring-1 ring-white/10 rounded-xl md:col-span-2">
          <div class="px-4 py-6 sm:p-8">
            <button
              type="button"
              @click="downloadBackup"
              class="rounded-md px-3 py-2 text-sm font-semibold text-gray-400 ring-1 ring-white/10 hover:ring-white/20"
            >
              {{ t('settings.backup.download') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Update (nur Admin) -->
      <div v-if="isAdmin" class="grid grid-cols-1 gap-x-8 gap-y-8 pt-10 md:grid-cols-3">
        <div>
          <SectionHeading :text="t('settings.update')" />
        </div>
        <div class="bg-gray-800/50 ring-1 ring-white/10 rounded-xl md:col-span-2">
          <div class="px-4 py-6 sm:p-8 space-y-3">
            <button
              type="button"
              :disabled="updating"
              @click="doUpdate"
              class="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {{ updating ? '…' : t('settings.update.run') }}
            </button>
            <p v-if="updateMsg" class="text-sm text-gray-400">{{ updateMsg }}</p>
          </div>
        </div>
      </div>

      <!-- Logout -->
      <div class="grid grid-cols-1 gap-x-8 gap-y-8 pt-10 md:grid-cols-3">
        <div></div>
        <div class="md:col-span-2">
          <div class="px-4 py-6 sm:p-8">
            <button
              type="button"
              @click="handleLogout"
              class="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500"
            >
              {{ t('settings.logout') }}
            </button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import SectionHeading from '../components/SectionHeading.vue'
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLocale } from '../composables/useLocale.js'
import { logout, setServerUrl, api } from '../api/client.js'
import { downloadBackup } from '../api/backup.js'
import { jwtDecode } from '../api/jwtDecode.js'

const { t, locale, setLocale } = useLocale()
const router = useRouter()

const serverUrl = ref(localStorage.getItem('server_url') || 'http://localhost:3000')
const updating = ref(false)
const updateMsg = ref('')
const status = ref(null)
const statusError = ref('')

onMounted(async () => {
  try {
    status.value = await api.get('/api/status')
  } catch {
    statusError.value = t('error.network')
  }
})

// Rolle aus JWT lesen (kein extra API-Call nötig)
const isAdmin = ref(false)
try {
  const token = localStorage.getItem('luxstage_token')
  if (token) isAdmin.value = jwtDecode(token)?.role === 'admin'
} catch { /* ignorieren */ }

function applyServer() {
  setServerUrl(serverUrl.value)
}

function handleLogout() {
  logout()
  router.push('/login')
}

async function doUpdate() {
  updating.value = true
  updateMsg.value = ''
  try {
    const res = await api.post('/api/update', {})
    updateMsg.value = t('settings.update.success')
  } catch (e) {
    updateMsg.value = t('settings.update.error', { message: e.message })
  } finally {
    updating.value = false
  }
}
</script>
