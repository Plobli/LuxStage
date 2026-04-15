<template>
  <div class="divide-y divide-white/10">

    <!-- Passwort ändern -->
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-white">{{ t('settings.account.change_password') }}</h2>
        <p class="mt-1 text-sm/6 text-gray-400">Ändere das Passwort für deinen Account.</p>
      </div>
      <form class="md:col-span-2" @submit.prevent="doChangePassword">
        <div class="grid grid-cols-1 gap-x-6 gap-y-6 sm:max-w-xl">
          <div>
            <label class="block text-sm/6 font-medium text-white mb-2">{{ t('settings.account.current_password') }}</label>
            <Input v-model="pwCurrent" type="password" required autocomplete="current-password" />
          </div>
          <div>
            <label class="block text-sm/6 font-medium text-white mb-2">{{ t('settings.account.new_password') }}</label>
            <Input v-model="pwNew" type="password" required autocomplete="new-password" />
          </div>
          <div>
            <label class="block text-sm/6 font-medium text-white mb-2">{{ t('settings.account.new_password.confirm') }}</label>
            <Input v-model="pwConfirm" type="password" required autocomplete="new-password" />
          </div>
          <p v-if="pwMsg" :class="pwMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'" class="text-sm">{{ pwMsg }}</p>
        </div>
        <div class="mt-8">
          <Button type="submit" :disabled="pwLoading">
            {{ pwLoading ? '…' : t('settings.account.change_password.submit') }}
          </Button>
        </div>
      </form>
    </div>

    <!-- Fotos pro Druckseite -->
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-white">{{ t('settings.photos_per_page') }}</h2>
        <p class="mt-1 text-sm/6 text-gray-400">{{ t('settings.photos_per_page.hint') }}</p>
      </div>
      <div class="md:col-span-2 sm:max-w-xl">
        <select
          :value="photosPerPage"
          @change="photosPerPage = Number($event.target.value)"
          class="rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent w-32"
        >
          <option v-for="n in VALID" :key="n" :value="n">{{ n }}</option>
        </select>
      </div>
    </div>

    <!-- Abmelden -->
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-white">{{ t('settings.logout') }}</h2>
        <p class="mt-1 text-sm/6 text-gray-400">Aktuelle Sitzung beenden.</p>
      </div>
      <div class="md:col-span-2 flex items-start">
        <Button variant="destructive" type="button" @click="handleLogout">
          {{ t('settings.logout') }}
        </Button>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLocale } from '../../composables/useLocale.js'
import { usePhotoSettings } from '../../composables/usePhotoSettings.js'
import { logout, changePassword } from '../../api/client.js'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const { t } = useLocale()
const { photosPerPage, VALID } = usePhotoSettings()
const router = useRouter()

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

function handleLogout() {
  logout()
  router.push('/login')
}
</script>
