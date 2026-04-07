<template>
  <div class="divide-y divide-white/10">

    <!-- Benutzerliste -->
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-white">{{ t('settings.users') }}</h2>
        <p class="mt-1 text-sm/6 text-gray-400">{{ t('settings.users.hint') }}</p>
      </div>
      <div class="md:col-span-2">
        <ul class="divide-y divide-white/5 text-sm">
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
        <p v-if="deleteMsg" :class="deleteMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'" class="mt-3 text-sm">{{ deleteMsg }}</p>
      </div>
    </div>

    <!-- Neuer Benutzer -->
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-white">{{ t('settings.users.new') }}</h2>
        <p class="mt-1 text-sm/6 text-gray-400">Legt einen neuen Benutzer mit Benutzername, Passwort und Rolle an.</p>
      </div>
      <form class="md:col-span-2" @submit.prevent="doCreateUser">
        <div class="space-y-4 sm:max-w-xl">
          <div>
            <label class="block text-sm/6 font-medium text-white mb-2">{{ t('settings.users.username') }}</label>
            <input v-model="newUsername" type="text" required pattern="[a-zA-Z0-9_-]+"
              class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent" />
          </div>
          <div>
            <label class="block text-sm/6 font-medium text-white mb-2">{{ t('settings.users.password') }}</label>
            <input v-model="newPassword" type="password" required minlength="8"
              class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent" />
          </div>
          <div>
            <label class="block text-sm/6 font-medium text-white mb-2">{{ t('settings.users.role') }}</label>
            <select v-model="newRole"
              class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent">
              <option value="techniker">{{ t('settings.users.role.techniker') }}</option>
              <option value="admin">{{ t('settings.users.role.admin') }}</option>
            </select>
          </div>
          <p v-if="usersMsg" :class="usersMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'" class="text-sm">{{ usersMsg }}</p>
        </div>
        <div class="mt-8">
          <button type="submit" :disabled="usersLoading"
            class="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
            {{ usersLoading ? '…' : t('settings.users.create') }}
          </button>
        </div>
      </form>
    </div>

    <!-- Passwort zurücksetzen -->
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-white">{{ t('settings.account.reset_password') }}</h2>
        <p class="mt-1 text-sm/6 text-gray-400">Setzt das Passwort eines Benutzers zurück und zeigt das neue temporäre Passwort an.</p>
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

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useLocale } from '../../composables/useLocale.js'
import { listUsers, createUser, deleteUser, resetPassword } from '../../api/client.js'

const { t } = useLocale()

const users = ref([])
const deleteMsg = ref('')
const newUsername = ref('')
const newPassword = ref('')
const newRole = ref('techniker')
const usersMsg = ref('')
const usersLoading = ref(false)
const resetUsername = ref('')
const resetMsg = ref('')
const resetLoading = ref(false)

async function loadUsers() {
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
    deleteMsg.value = t('settings.users.error', { message: e.message })
  }
}

async function doResetPassword() {
  resetMsg.value = ''
  resetLoading.value = true
  try {
    const { newPassword: pw } = await resetPassword(resetUsername.value)
    resetMsg.value = t('settings.account.reset_password.success', { password: pw })
  } catch (e) {
    resetMsg.value = t('settings.account.reset_password.error', { message: e.message })
  } finally {
    resetLoading.value = false
  }
}

onMounted(loadUsers)
</script>
