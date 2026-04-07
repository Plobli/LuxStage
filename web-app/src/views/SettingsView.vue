<template>
  <div>
    <!-- Horizontale Sub-Navigation -->
    <header class="border-b border-white/10">
      <nav class="flex overflow-x-auto py-4">
        <ul role="list" class="flex min-w-full flex-none gap-x-6 px-4 text-sm/6 font-semibold text-gray-400 sm:px-6 lg:px-8">
          <li v-for="item in nav" :key="item.key">
            <button
              @click="scrollTo(item.key)"
              :class="activeSection === item.key ? 'text-accent' : 'hover:text-white'"
              class="transition-colors"
            >
              {{ item.label }}
            </button>
          </li>
        </ul>
      </nav>
    </header>

    <!-- Einstellungsblöcke -->
    <div class="divide-y divide-white/10">

      <!-- Konto -->
      <div :ref="el => sectionRefs['account'] = el" class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <h2 class="text-base/7 font-semibold text-white">{{ t('settings.account.change_password') }}</h2>
          <p class="mt-1 text-sm/6 text-gray-400">{{ t('settings.account.change_password') }}</p>
        </div>
        <form class="md:col-span-2" @submit.prevent="doChangePassword">
          <div class="grid grid-cols-1 gap-x-6 gap-y-6 sm:max-w-xl">
            <div>
              <label class="block text-sm/6 font-medium text-white mb-2">{{ t('settings.account.current_password') }}</label>
              <input v-model="pwCurrent" type="password" required autocomplete="current-password"
                class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent" />
            </div>
            <div>
              <label class="block text-sm/6 font-medium text-white mb-2">{{ t('settings.account.new_password') }}</label>
              <input v-model="pwNew" type="password" required autocomplete="new-password"
                class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent" />
            </div>
            <div>
              <label class="block text-sm/6 font-medium text-white mb-2">{{ t('settings.account.new_password.confirm') }}</label>
              <input v-model="pwConfirm" type="password" required autocomplete="new-password"
                class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent" />
            </div>
            <p v-if="pwMsg" :class="pwMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'" class="text-sm">{{ pwMsg }}</p>
          </div>
          <div class="mt-8 flex gap-3">
            <button type="submit" :disabled="pwLoading"
              class="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
              {{ pwLoading ? '…' : t('settings.account.change_password.submit') }}
            </button>
            <button type="button" @click="handleLogout"
              class="rounded-md bg-white/5 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10">
              {{ t('settings.logout') }}
            </button>
          </div>
        </form>
      </div>

      <!-- Admin: Passwort zurücksetzen -->
      <div v-if="isAdmin" class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <h2 class="text-base/7 font-semibold text-white">{{ t('settings.account.reset_password') }}</h2>
          <p class="mt-1 text-sm/6 text-gray-400">Setzt das Passwort eines anderen Benutzers zurück und zeigt das neue temporäre Passwort an.</p>
        </div>
        <form class="md:col-span-2" @submit.prevent="doResetPassword">
          <div class="sm:max-w-xl">
            <label class="block text-sm/6 font-medium text-white mb-2">{{ t('settings.account.reset_password.username') }}</label>
            <input v-model="resetUsername" type="text" required
              class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent" />
            <p v-if="resetMsg" :class="resetMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'" class="mt-3 text-sm font-mono">{{ resetMsg }}</p>
          </div>
          <div class="mt-8">
            <button type="submit" :disabled="resetLoading"
              class="rounded-md bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-50">
              {{ resetLoading ? '…' : t('settings.account.reset_password.submit') }}
            </button>
          </div>
        </form>
      </div>

      <!-- Anzeige -->
      <div :ref="el => sectionRefs['display'] = el" class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <h2 class="text-base/7 font-semibold text-white">{{ t('settings.language') }}</h2>
          <p class="mt-1 text-sm/6 text-gray-400">{{ t('settings.language.hint') }}</p>
        </div>
        <div class="md:col-span-2 space-y-8 sm:max-w-xl">
          <!-- Sprache -->
          <div>
            <p class="text-sm/6 font-medium text-white mb-3">{{ t('settings.language') }}</p>
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
          </div>
          <!-- Fotos pro Seite -->
          <div>
            <label class="block text-sm/6 font-medium text-white mb-2">{{ t('settings.photos_per_page') }}</label>
            <select
              :value="photosPerPage"
              @change="photosPerPage = Number($event.target.value)"
              class="rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent w-32"
            >
              <option v-for="n in VALID" :key="n" :value="n">{{ n }}</option>
            </select>
            <p class="mt-1 text-xs text-gray-500">{{ t('settings.photos_per_page.hint') }}</p>
          </div>
        </div>
      </div>

      <!-- Server & Status -->
      <div :ref="el => sectionRefs['server'] = el" class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <h2 class="text-base/7 font-semibold text-white">{{ t('settings.server') }}</h2>
          <p class="mt-1 text-sm/6 text-gray-400">{{ t('settings.server_url.label') }}</p>
        </div>
        <div class="md:col-span-2 space-y-6 sm:max-w-xl">
          <div>
            <label class="block text-sm/6 font-medium text-white mb-2">{{ t('settings.server_url') }}</label>
            <input
              v-model="serverUrl"
              type="url"
              :placeholder="t('settings.server_url.placeholder')"
              @change="applyServer"
              class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent"
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

      <!-- Backup -->
      <div :ref="el => sectionRefs['backup'] = el" class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <h2 class="text-base/7 font-semibold text-white">{{ t('settings.backup') }}</h2>
          <p class="mt-1 text-sm/6 text-gray-400">{{ t('settings.backup.hint') }}</p>
        </div>
        <div class="md:col-span-2 space-y-10 sm:max-w-xl">
          <!-- Download -->
          <div>
            <button
              type="button"
              @click="downloadBackup"
              class="rounded-md px-3 py-2 text-sm font-semibold text-gray-300 ring-1 ring-white/10 hover:ring-white/20"
            >
              {{ t('settings.backup.download') }}
            </button>
          </div>
          <!-- Wiederherstellen -->
          <div>
            <h3 class="text-sm/6 font-medium text-white mb-1">{{ t('settings.backup.restore') }}</h3>
            <p class="text-sm text-gray-400 mb-4">{{ t('settings.backup.restore.hint') }}</p>
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

      <!-- Benutzer (nur Admin) -->
      <div v-if="isAdmin" :ref="el => sectionRefs['users'] = el" class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <h2 class="text-base/7 font-semibold text-white">{{ t('settings.users') }}</h2>
          <p class="mt-1 text-sm/6 text-gray-400">{{ t('settings.users.hint') }}</p>
        </div>
        <div class="md:col-span-2">
          <!-- Benutzerliste -->
          <ul class="divide-y divide-white/5 text-sm mb-10">
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
          <!-- Neuer Benutzer -->
          <div>
            <h3 class="text-sm/6 font-medium text-white mb-4">{{ t('settings.users.new') }}</h3>
            <form class="space-y-4 sm:max-w-xl" @submit.prevent="doCreateUser">
              <div>
                <label class="block text-sm font-medium text-white mb-2">{{ t('settings.users.username') }}</label>
                <input v-model="newUsername" type="text" required pattern="[a-zA-Z0-9_-]+"
                  class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent" />
              </div>
              <div>
                <label class="block text-sm font-medium text-white mb-2">{{ t('settings.users.password') }}</label>
                <input v-model="newPassword" type="password" required minlength="8"
                  class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent" />
              </div>
              <div>
                <label class="block text-sm font-medium text-white mb-2">{{ t('settings.users.role') }}</label>
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
        </div>
      </div>

      <!-- Update (nur Admin) -->
      <div v-if="isAdmin" :ref="el => sectionRefs['update'] = el" class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLocale } from '../composables/useLocale.js'
import { usePhotoSettings } from '../composables/usePhotoSettings.js'
import { logout, setServerUrl, api, changePassword, resetPassword, listUsers, createUser, deleteUser } from '../api/client.js'
import { downloadBackup, uploadRestore } from '../api/backup.js'
import { jwtDecode } from '../api/jwtDecode.js'
import { updateAvailable } from '../composables/useUpdateCheck.js'

const { t, locale, setLocale } = useLocale()
const { photosPerPage, VALID } = usePhotoSettings()
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
const selectedBranch = ref('main')
const availableBranches = ref(['main'])
const status = ref(null)
const statusError = ref('')

const isAdmin = ref(false)
try {
  const token = localStorage.getItem('luxstage_token')
  if (token) isAdmin.value = jwtDecode(token)?.role === 'admin'
} catch { /* ignorieren */ }

// Navigations-Einträge
const nav = computed(() => [
  { key: 'account', label: t('settings.account') },
  { key: 'display', label: t('settings.language') },
  { key: 'server', label: t('settings.server') },
  { key: 'backup', label: t('settings.backup') },
  ...(isAdmin.value ? [{ key: 'users', label: t('settings.users') }] : []),
  ...(isAdmin.value ? [{ key: 'update', label: t('settings.update') }] : []),
])

// Aktive Sektion per IntersectionObserver
const activeSection = ref('account')
const sectionRefs = ref({})
let observer = null

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          activeSection.value = entry.target.dataset.section
          break
        }
      }
    },
    { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
  )
  // Kurz warten bis refs gesetzt sind
  setTimeout(() => {
    for (const [key, el] of Object.entries(sectionRefs.value)) {
      if (el) {
        el.dataset.section = key
        observer.observe(el)
      }
    }
  }, 100)
})

onUnmounted(() => observer?.disconnect())

function scrollTo(key) {
  sectionRefs.value[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

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

// Passwort ändern
const pwCurrent = ref('')
const pwNew = ref('')
const pwConfirm = ref('')
const pwMsg = ref('')
const pwLoading = ref(false)

async function doChangePassword() {
  pwMsg.value = ''
  if (pwNew.value.length < 8) { pwMsg.value = t('settings.account.change_password.error.short'); return }
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

async function loadBranches() {
  try {
    const { branches } = await api.get('/api/update/branches')
    if (branches?.length) availableBranches.value = branches
  } catch { /* ignore, fallback to ['main'] */ }
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

onMounted(async () => {
  try {
    status.value = await api.get('/api/status')
  } catch {
    statusError.value = t('error.network')
  }
  if (isAdmin.value) { loadBranches(); checkForUpdate() }
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
</script>
