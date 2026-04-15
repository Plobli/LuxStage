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
              <Badge :variant="u.role === 'admin' ? 'default' : 'secondary'">{{ t('settings.users.role.' + u.role) }}</Badge>
              <Badge variant="outline" class="text-gray-400 border-white/10">{{ t('settings.users.source.' + u.source) }}</Badge>
            </div>
            <Button v-if="u.source === 'db'" variant="ghost" size="sm" @click="doDeleteUser(u.username)"
              class="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10">
              {{ t('settings.users.delete') }}
            </Button>
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
            <Input v-model="newUsername" type="text" required pattern="[a-zA-Z0-9_-]+" />
          </div>
          <div>
            <label class="block text-sm/6 font-medium text-white mb-2">{{ t('settings.users.password') }}</label>
            <Input v-model="newPassword" type="password" required minlength="8" />
          </div>
          <div>
            <label class="block text-sm/6 font-medium text-white mb-2">{{ t('settings.users.role') }}</label>
            <Select v-model="newRole">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="techniker">{{ t('settings.users.role.techniker') }}</SelectItem>
                <SelectItem value="admin">{{ t('settings.users.role.admin') }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p v-if="usersMsg" :class="usersMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'" class="text-sm">{{ usersMsg }}</p>
        </div>
        <div class="mt-8">
          <Button type="submit" :disabled="usersLoading">
            {{ usersLoading ? '…' : t('settings.users.create') }}
          </Button>
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
          <Input v-model="resetUsername" type="text" required />
          <p v-if="resetMsg" :class="resetMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'" class="mt-3 text-sm font-mono">{{ resetMsg }}</p>
        </div>
        <div class="mt-8">
          <Button type="submit" variant="secondary" :disabled="resetLoading">
            {{ resetLoading ? '…' : t('settings.account.reset_password.submit') }}
          </Button>
        </div>
      </form>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
