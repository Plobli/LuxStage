<template>
  <div class="mx-auto max-w-7xl lg:flex lg:gap-x-16 lg:px-8">

    <!-- Seitennavigation -->
    <aside class="flex overflow-x-auto border-b border-white/10 py-4 lg:block lg:w-64 lg:flex-none lg:border-0 lg:py-12">
      <nav class="flex-none px-4 sm:px-6 lg:px-0">
        <ul role="list" class="flex gap-x-3 gap-y-1 whitespace-nowrap lg:flex-col">
          <li v-for="item in secondaryNav" :key="item.key">
            <button
              @click="activeSection = item.key"
              :class="[
                activeSection === item.key
                  ? 'bg-white/5 text-white'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white',
                'group flex w-full gap-x-3 rounded-md py-2 pr-3 pl-2 text-sm/6 font-semibold'
              ]"
            >
              <component :is="item.icon" :class="[activeSection === item.key ? 'text-white' : 'text-gray-500 group-hover:text-white', 'size-6 shrink-0']" aria-hidden="true" />
              {{ item.name }}
            </button>
          </li>
        </ul>
      </nav>
    </aside>

    <!-- Hauptinhalt -->
    <main class="px-4 py-10 sm:px-6 lg:flex-auto lg:px-0 lg:py-12">
      <div class="mx-auto max-w-2xl space-y-16 lg:mx-0 lg:max-w-none">

        <!-- Sprache -->
        <section v-show="activeSection === 'general'">
          <h2 class="text-base/7 font-semibold text-white">{{ t('settings.language') }}</h2>
          <p class="mt-1 text-sm/6 text-gray-400">{{ t('settings.language.hint') }}</p>
          <dl class="mt-6 divide-y divide-white/5 border-t border-white/5 text-sm/6">
            <div class="py-6 sm:flex sm:items-center">
              <dt class="font-medium text-white sm:w-64 sm:flex-none sm:pr-6">{{ t('settings.language') }}</dt>
              <dd class="mt-1 sm:mt-0 sm:flex-auto">
                <div class="flex gap-6">
                  <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input type="radio" :checked="locale === 'de'" value="de" @change="setLocale('de')" class="accent-accent" />
                    {{ t('settings.language.de') }}
                  </label>
                  <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input type="radio" :checked="locale === 'en'" value="en" @change="setLocale('en')" class="accent-accent" />
                    {{ t('settings.language.en') }}
                  </label>
                </div>
              </dd>
            </div>
          </dl>
        </section>

        <!-- Server -->
        <section v-show="activeSection === 'server'">
          <h2 class="text-base/7 font-semibold text-white">{{ t('settings.server') }}</h2>
          <p class="mt-1 text-sm/6 text-gray-400">{{ t('settings.server_url.label') }}</p>
          <dl class="mt-6 divide-y divide-white/5 border-t border-white/5 text-sm/6">
            <div class="py-6">
              <input
                v-model="serverUrl"
                type="url"
                :placeholder="t('settings.server_url.placeholder')"
                @change="applyServer"
                class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent"
              />
            </div>
            <template v-if="status">
              <div class="py-4 sm:flex">
                <dt class="font-medium text-white sm:w-64 sm:flex-none sm:pr-6">{{ t('settings.status.version') }}</dt>
                <dd class="mt-1 text-gray-300 sm:mt-0 sm:flex-auto">{{ status.version }}</dd>
              </div>
              <div class="py-4 sm:flex">
                <dt class="font-medium text-white sm:w-64 sm:flex-none sm:pr-6">{{ t('settings.status.disk') }}</dt>
                <dd class="mt-1 text-gray-300 sm:mt-0 sm:flex-auto">{{ status.diskFree }}</dd>
              </div>
            </template>
            <div v-else-if="statusError" class="py-4">
              <p class="text-sm text-red-400">{{ statusError }}</p>
            </div>
          </dl>
        </section>

        <!-- Backup -->
        <section v-show="activeSection === 'backup'">
          <h2 class="text-base/7 font-semibold text-white">{{ t('settings.backup') }}</h2>
          <p class="mt-1 text-sm/6 text-gray-400">{{ t('settings.backup.hint') }}</p>
          <div class="mt-6 border-t border-white/5 pt-6">
            <button
              type="button"
              @click="downloadBackup"
              class="rounded-md px-3 py-2 text-sm font-semibold text-gray-300 ring-1 ring-white/10 hover:ring-white/20"
            >
              {{ t('settings.backup.download') }}
            </button>
          </div>
        </section>

        <!-- Update (nur Admin) -->
        <section v-if="isAdmin" v-show="activeSection === 'update'">
          <h2 class="text-base/7 font-semibold text-white">{{ t('settings.update') }}</h2>
          <p class="mt-1 text-sm/6 text-gray-400">{{ t('settings.update.hint') }}</p>
          <div class="mt-6 border-t border-white/5 pt-6 space-y-3">
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
        </section>

        <!-- Konto -->
        <section v-show="activeSection === 'account'">
          <h2 class="text-base/7 font-semibold text-white">{{ t('settings.logout') }}</h2>
          <div class="mt-6 border-t border-white/5 pt-6">
            <button
              type="button"
              @click="handleLogout"
              class="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500"
            >
              {{ t('settings.logout') }}
            </button>
          </div>
        </section>

      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLocale } from '../composables/useLocale.js'
import { logout, setServerUrl, api } from '../api/client.js'
import { downloadBackup } from '../api/backup.js'
import { jwtDecode } from '../api/jwtDecode.js'
import {
  LanguageIcon,
  ServerIcon,
  ArchiveBoxArrowDownIcon,
  ArrowPathIcon,
  ArrowLeftStartOnRectangleIcon,
} from '@heroicons/vue/24/outline'

const { t, locale, setLocale } = useLocale()
const router = useRouter()

const serverUrl = ref(localStorage.getItem('server_url') || 'http://localhost:3000')
const updating = ref(false)
const updateMsg = ref('')
const status = ref(null)
const statusError = ref('')
const activeSection = ref('general')

const isAdmin = ref(false)
try {
  const token = localStorage.getItem('luxstage_token')
  if (token) isAdmin.value = jwtDecode(token)?.role === 'admin'
} catch { /* ignorieren */ }

const secondaryNav = computed(() => [
  { key: 'general', name: t('settings.language'), icon: LanguageIcon },
  { key: 'server', name: t('settings.server'), icon: ServerIcon },
  { key: 'backup', name: t('settings.backup'), icon: ArchiveBoxArrowDownIcon },
  ...(isAdmin.value ? [{ key: 'update', name: t('settings.update'), icon: ArrowPathIcon }] : []),
  { key: 'account', name: t('nav.logout'), icon: ArrowLeftStartOnRectangleIcon },
])

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

function handleLogout() {
  logout()
  router.push('/login')
}

async function doUpdate() {
  updating.value = true
  updateMsg.value = ''
  try {
    await api.post('/api/update', {})
    updateMsg.value = t('settings.update.success')
  } catch (e) {
    updateMsg.value = t('settings.update.error', { message: e.message })
  } finally {
    updating.value = false
  }
}
</script>
