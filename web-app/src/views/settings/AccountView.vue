<template>
  <div class="divide-y divide-border">

    <!-- Passwort ändern -->
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-foreground">{{ t('settings.account.change_password') }}</h2>
        <p class="mt-1 text-sm/6 text-muted-foreground">Ändere das Passwort für deinen Account.</p>
      </div>
      <form class="md:col-span-2" @submit.prevent="doChangePassword">
        <div class="grid grid-cols-1 gap-x-6 gap-y-6 sm:max-w-xl">
          <div class="space-y-2">
            <Label for="pw-current">{{ t('settings.account.current_password') }}</Label>
            <Input id="pw-current" v-model="pwCurrent" type="password" required autocomplete="current-password" />
          </div>
          <div class="space-y-2">
            <Label for="pw-new">{{ t('settings.account.new_password') }}</Label>
            <Input id="pw-new" v-model="pwNew" type="password" required autocomplete="new-password" />
          </div>
          <div class="space-y-2">
            <Label for="pw-confirm">{{ t('settings.account.new_password.confirm') }}</Label>
            <Input id="pw-confirm" v-model="pwConfirm" type="password" required autocomplete="new-password" />
          </div>
          <Alert v-if="pwMsg" :variant="pwMsg.startsWith('✓') ? 'default' : 'destructive'">
            <AlertDescription>{{ pwMsg }}</AlertDescription>
          </Alert>
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
        <h2 class="text-base/7 font-semibold text-foreground">{{ t('settings.photos_per_page') }}</h2>
        <p class="mt-1 text-sm/6 text-muted-foreground">{{ t('settings.photos_per_page.hint') }}</p>
      </div>
      <div class="md:col-span-2 sm:max-w-xl">
        <Select :model-value="String(photosPerPage)" @update:model-value="photosPerPage = Number($event)">
          <SelectTrigger class="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="n in VALID" :key="n" :value="String(n)">{{ n }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <!-- Abmelden -->
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-foreground">{{ t('settings.logout') }}</h2>
        <p class="mt-1 text-sm/6 text-muted-foreground">Aktuelle Sitzung beenden.</p>
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
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

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
