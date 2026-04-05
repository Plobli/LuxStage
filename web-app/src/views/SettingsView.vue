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
            <div class="py-4 sm:flex">
              <dt class="font-medium text-white sm:w-64 sm:flex-none sm:pr-6">{{ t('settings.status.version.app') }}</dt>
              <dd class="mt-1 text-gray-300 sm:mt-0 sm:flex-auto">{{ appVersion }}</dd>
            </div>
            <div class="py-4 sm:flex">
              <dt class="font-medium text-white sm:w-64 sm:flex-none sm:pr-6">{{ t('settings.status.version.server') }}</dt>
              <dd class="mt-1 sm:mt-0 sm:flex-auto">
                <span v-if="status" class="text-gray-300">{{ status.version }}</span>
                <span v-else-if="statusError" class="text-red-400 text-sm">{{ t('error.network') }}</span>
                <span v-else class="text-gray-500 text-sm">…</span>
              </dd>
            </div>
            <div v-if="status" class="py-4 sm:flex">
              <dt class="font-medium text-white sm:w-64 sm:flex-none sm:pr-6">{{ t('settings.status.disk') }}</dt>
              <dd class="mt-1 text-gray-300 sm:mt-0 sm:flex-auto">{{ status.diskFree }}</dd>
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

          <!-- Wiederherstellen -->
          <div class="mt-10 border-t border-white/5 pt-6">
            <h3 class="text-sm font-semibold text-white">{{ t('settings.backup.restore') }}</h3>
            <p class="mt-1 text-sm/6 text-gray-400">{{ t('settings.backup.restore.hint') }}</p>
            <div class="mt-4 flex items-center gap-3">
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
        </section>

        <!-- Benutzer (nur Admin) -->
        <section v-if="isAdmin" v-show="activeSection === 'users'">
          <h2 class="text-base/7 font-semibold text-white">{{ t('settings.users') }}</h2>
          <p class="mt-1 text-sm/6 text-gray-400">{{ t('settings.users.hint') }}</p>

          <!-- Benutzerliste -->
          <ul class="mt-6 divide-y divide-white/5 border-t border-white/5 text-sm">
            <li v-for="u in users" :key="u.username" class="flex items-center justify-between py-3">
              <div class="flex items-center gap-3">
                <span class="text-white font-medium">{{ u.username }}</span>
                <span class="text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded">{{ t('settings.users.role.' + u.role) }}</span>
                <span class="text-xs text-gray-600">{{ t('settings.users.source.' + u.source) }}</span>
              </div>
              <button v-if="u.source === 'db'" @click="doDeleteUser(u.username)"
                class="text-xs text-red-400 hover:text-red-300">
                {{ t('settings.users.delete') }}
              </button>
            </li>
          </ul>

          <!-- Neuen Benutzer anlegen -->
          <div class="mt-8">
            <h3 class="text-sm font-semibold text-white">{{ t('settings.users.new') }}</h3>
            <form class="mt-4 space-y-4 max-w-md" @submit.prevent="doCreateUser">
              <div>
                <label class="block text-sm font-medium text-white mb-1">{{ t('settings.users.username') }}</label>
                <input v-model="newUsername" type="text" required pattern="[a-zA-Z0-9_-]+"
                  class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent" />
              </div>
              <div>
                <label class="block text-sm font-medium text-white mb-1">{{ t('settings.users.password') }}</label>
                <input v-model="newPassword" type="password" required minlength="4"
                  class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent" />
              </div>
              <div>
                <label class="block text-sm font-medium text-white mb-1">{{ t('settings.users.role') }}</label>
                <select v-model="newRole"
                  class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent">
                  <option value="techniker">{{ t('settings.users.role.techniker') }}</option>
                  <option value="admin">{{ t('settings.users.role.admin') }}</option>
                </select>
              </div>
              <p v-if="usersMsg" :class="usersMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'" class="text-sm">{{ usersMsg }}</p>
              <button type="submit" :disabled="usersLoading"
                class="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
                {{ usersLoading ? '…' : t('settings.users.create') }}
              </button>
            </form>
          </div>
        </section>

        <!-- Update (nur Admin) -->
        <section v-if="isAdmin" v-show="activeSection === 'update'">
          <h2 class="text-base/7 font-semibold text-white">{{ t('settings.update') }}</h2>
          <p class="mt-1 text-sm/6 text-gray-400">{{ t('settings.update.hint') }}</p>
          <div class="mt-6 border-t border-white/5 pt-6 space-y-4">

            <!-- Check-Status -->
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

            <!-- Changelog-Preview -->
            <pre v-if="checkResult?.log" class="text-xs text-gray-400 bg-white/5 rounded-md px-3 py-2 whitespace-pre-wrap font-mono">{{ checkResult.log }}</pre>

            <!-- Update-Button -->
            <button
              type="button"
              :disabled="updating || !checkResult?.available"
              @click="doUpdate"
              class="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {{ updating ? '…' : t('settings.update.run') }}
            </button>

            <!-- Ergebnis -->
            <p v-if="updateMsg" :class="updateError ? 'text-red-400' : 'text-green-400'" class="text-sm">{{ updateMsg }}</p>
            <pre v-if="updateLog.length" class="text-xs text-gray-500 bg-white/5 rounded-md px-3 py-2 whitespace-pre-wrap font-mono">{{ updateLog.join('\n') }}</pre>
          </div>
        </section>

        <!-- Konto -->
        <section v-show="activeSection === 'account'" class="space-y-10">

          <!-- Passwort ändern -->
          <div>
            <h2 class="text-base/7 font-semibold text-white">{{ t('settings.account.change_password') }}</h2>
            <form class="mt-6 border-t border-white/5 pt-6 space-y-4 max-w-md" @submit.prevent="doChangePassword">
              <div>
                <label class="block text-sm font-medium text-white mb-1">{{ t('settings.account.current_password') }}</label>
                <input v-model="pwCurrent" type="password" required
                  class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent" />
              </div>
              <div>
                <label class="block text-sm font-medium text-white mb-1">{{ t('settings.account.new_password') }}</label>
                <input v-model="pwNew" type="password" required
                  class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent" />
              </div>
              <div>
                <label class="block text-sm font-medium text-white mb-1">{{ t('settings.account.new_password.confirm') }}</label>
                <input v-model="pwConfirm" type="password" required
                  class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent" />
              </div>
              <p v-if="pwMsg" :class="pwMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'" class="text-sm">{{ pwMsg }}</p>
              <button type="submit" :disabled="pwLoading"
                class="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
                {{ pwLoading ? '…' : t('settings.account.change_password.submit') }}
              </button>
            </form>
          </div>

          <!-- Admin: Passwort eines anderen Benutzers zurücksetzen -->
          <div v-if="isAdmin">
            <h2 class="text-base/7 font-semibold text-white">{{ t('settings.account.reset_password') }}</h2>
            <form class="mt-6 border-t border-white/5 pt-6 space-y-4 max-w-md" @submit.prevent="doResetPassword">
              <div>
                <label class="block text-sm font-medium text-white mb-1">{{ t('settings.account.reset_password.username') }}</label>
                <input v-model="resetUsername" type="text" required
                  class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent" />
              </div>
              <p v-if="resetMsg" :class="resetMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'" class="text-sm font-mono">{{ resetMsg }}</p>
              <button type="submit" :disabled="resetLoading"
                class="rounded-md bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-50">
                {{ resetLoading ? '…' : t('settings.account.reset_password.submit') }}
              </button>
            </form>
          </div>

          <!-- Abmelden -->
          <div>
            <h2 class="text-base/7 font-semibold text-white">{{ t('settings.logout') }}</h2>
            <div class="mt-6 border-t border-white/5 pt-6">
              <button type="button" @click="handleLogout"
                class="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500">
                {{ t('settings.logout') }}
              </button>
            </div>
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
import { logout, setServerUrl, api, changePassword, resetPassword, listUsers, createUser, deleteUser } from '../api/client.js'
import { downloadBackup, uploadRestore } from '../api/backup.js'
import { jwtDecode } from '../api/jwtDecode.js'
import { updateAvailable } from '../composables/useUpdateCheck.js'
import {
  LanguageIcon,
  ServerIcon,
  ArchiveBoxArrowDownIcon,
  ArrowPathIcon,
  ArrowLeftStartOnRectangleIcon,
  UsersIcon,
} from '@heroicons/vue/24/outline'

const { t, locale, setLocale } = useLocale()
const router = useRouter()

/* global __APP_VERSION__ */
const appVersion = __APP_VERSION__
const serverUrl = ref(localStorage.getItem('server_url') || 'http://localhost:3000')
const updating = ref(false)
const updateMsg = ref('')
const updateError = ref(false)
const updateLog = ref([])
const checkLoading = ref(false)
const checkResult = ref(null)
const checkError = ref(false)
const status = ref(null)
const statusError = ref('')
const activeSection = ref('general')

// Backup-Restore
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

const isAdmin = ref(false)
try {
  const token = localStorage.getItem('luxstage_token')
  if (token) isAdmin.value = jwtDecode(token)?.role === 'admin'
} catch { /* ignorieren */ }

// Passwort ändern
const pwCurrent = ref('')
const pwNew = ref('')
const pwConfirm = ref('')
const pwMsg = ref('')
const pwLoading = ref(false)

async function doChangePassword() {
  pwMsg.value = ''
  if (pwNew.value.length < 4) { pwMsg.value = t('settings.account.change_password.error.short'); return }
  if (pwNew.value !== pwConfirm.value) { pwMsg.value = t('settings.account.change_password.error.mismatch'); return }
  pwLoading.value = true
  try {
    await changePassword(pwCurrent.value, pwNew.value)
    pwMsg.value = t('settings.account.change_password.success')
    pwCurrent.value = ''; pwNew.value = ''; pwConfirm.value = ''
  } catch (e) {
    pwMsg.value = e.message.includes('403') || e.message.toLowerCase().includes('falsch')
      ? t('settings.account.change_password.error.wrong')
      : e.message
  } finally {
    pwLoading.value = false
  }
}

// Admin: Passwort zurücksetzen
const resetUsername = ref('')
const resetMsg = ref('')
const resetLoading = ref(false)

async function doResetPassword() {
  resetMsg.value = ''
  resetLoading.value = true
  try {
    const { newPassword } = await resetPassword(resetUsername.value)
    resetMsg.value = t('settings.account.reset_password.success', { password: newPassword })
  } catch (e) {
    resetMsg.value = t('settings.account.reset_password.error', { message: e.message })
  } finally {
    resetLoading.value = false
  }
}

// Benutzerverwaltung (Admin)
const users = ref([])
const newUsername = ref('')
const newPassword = ref('')
const newRole = ref('techniker')
const usersMsg = ref('')
const usersLoading = ref(false)

async function loadUsers() {
  if (!isAdmin.value) return
  try { users.value = await listUsers() } catch { /* ignore */ }
}

async function doCreateUser() {
  usersMsg.value = ''
  usersLoading.value = true
  try {
    await createUser(newUsername.value, newPassword.value, newRole.value)
    usersMsg.value = t('settings.users.success')
    newUsername.value = ''; newPassword.value = ''; newRole.value = 'techniker'
    await loadUsers()
  } catch (e) {
    usersMsg.value = t('settings.users.error', { message: e.message })
  } finally {
    usersLoading.value = false
  }
}

async function doDeleteUser(username) {
  if (!confirm(t('settings.users.delete.confirm', { username }))) return
  try {
    await deleteUser(username)
    await loadUsers()
  } catch (e) {
    usersMsg.value = t('settings.users.error', { message: e.message })
  }
}

const secondaryNav = computed(() => [
  { key: 'general', name: t('settings.language'), icon: LanguageIcon },
  { key: 'server', name: t('settings.server'), icon: ServerIcon },
  { key: 'backup', name: t('settings.backup'), icon: ArchiveBoxArrowDownIcon },
  ...(isAdmin.value ? [{ key: 'update', name: t('settings.update'), icon: ArrowPathIcon }] : []),
  ...(isAdmin.value ? [{ key: 'users', name: t('settings.users'), icon: UsersIcon }] : []),
  { key: 'account', name: t('settings.account'), icon: ArrowLeftStartOnRectangleIcon },
])

async function checkForUpdate() {
  checkLoading.value = true
  checkResult.value = null
  checkError.value = false
  try {
    checkResult.value = await api.get('/api/update/check')
  } catch {
    checkError.value = true
  } finally {
    checkLoading.value = false
  }
}

onMounted(async () => {
  try {
    status.value = await api.get('/api/status')
  } catch {
    statusError.value = t('error.network')
  }
  if (isAdmin.value) checkForUpdate()
  await loadUsers()
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
  updateError.value = false
  updateLog.value = []
  try {
    const result = await api.post('/api/update', {})
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
    // Nach Fehler erneut prüfen ob wirklich zurückgerollt
    checkForUpdate()
  } finally {
    updating.value = false
  }
}
</script>
