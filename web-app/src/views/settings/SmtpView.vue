<template>
  <div class="divide-y divide-border">
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-foreground">{{ t('settings.smtp') }}</h2>
        <p class="mt-1 text-sm/6 text-muted-foreground">{{ t('settings.smtp.hint') }}</p>
      </div>
      <form class="md:col-span-2" @submit.prevent="doSave">
        <div class="space-y-4 sm:max-w-xl">
          <div class="space-y-2">
            <Label for="smtp-host">{{ t('settings.smtp.host') }}</Label>
            <Input id="smtp-host" v-model="form.host" type="text" placeholder="mail.example.com" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="smtp-port">{{ t('settings.smtp.port') }}</Label>
              <Input id="smtp-port" v-model="form.port" type="number" placeholder="587" />
            </div>
            <div class="flex items-end gap-2 pb-0.5">
              <input id="smtp-secure" v-model="form.secure" type="checkbox" class="h-4 w-4 rounded border-border" />
              <Label for="smtp-secure">{{ t('settings.smtp.secure') }}</Label>
            </div>
          </div>
          <div class="space-y-2">
            <Label for="smtp-user">{{ t('settings.smtp.user') }}</Label>
            <Input id="smtp-user" v-model="form.user" type="text" autocomplete="off" />
          </div>
          <div class="space-y-2">
            <Label for="smtp-pass">{{ t('settings.smtp.pass') }}</Label>
            <Input id="smtp-pass" v-model="form.pass" type="password" :placeholder="passPlaceholder" autocomplete="new-password" />
          </div>
          <div class="space-y-2">
            <Label for="smtp-from">{{ t('settings.smtp.from') }}</Label>
            <Input id="smtp-from" v-model="form.from" type="text" placeholder="LuxStage <noreply@example.com>" />
          </div>
          <Alert v-if="msg" :variant="msg.startsWith('✓') ? 'default' : 'destructive'">
            <AlertDescription>{{ msg }}</AlertDescription>
          </Alert>
        </div>
        <div class="mt-8 flex gap-3">
          <Button type="submit" :disabled="loading">
            {{ loading ? '…' : t('settings.smtp.save') }}
          </Button>
          <Button type="button" variant="secondary" :disabled="testLoading" @click="doTest">
            {{ testLoading ? '…' : t('settings.smtp.test') }}
          </Button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useLocale } from '../../composables/useLocale.js'
import { getSmtpConfig, saveSmtpConfig, testSmtpConfig } from '../../api/client.js'
import { jwtDecode } from '../../api/jwtDecode.js'

const { t } = useLocale()

const form = ref({ host: '', port: '587', secure: false, user: '', pass: '', from: '' })
const passPlaceholder = ref('')
const msg = ref('')
const loading = ref(false)
const testLoading = ref(false)

const userEmail = computed(() => {
  try {
    const token = localStorage.getItem('luxstage_token')
    return token ? jwtDecode(token)?.email || '' : ''
  } catch { return '' }
})

onMounted(async () => {
  try {
    const cfg = await getSmtpConfig()
    passPlaceholder.value = cfg.pass ? '••••••••' : ''
    form.value = { ...cfg, pass: '' }
  } catch { /* ignore */ }
})

async function doSave() {
  msg.value = ''
  loading.value = true
  try {
    await saveSmtpConfig(form.value)
    msg.value = t('settings.smtp.success')
    if (form.value.pass) passPlaceholder.value = '••••••••'
  } catch (e) {
    msg.value = t('settings.smtp.error', { message: e.message })
  } finally {
    loading.value = false
  }
}

async function doTest() {
  const to = prompt('Test-Mail senden an:', userEmail.value || '')
  if (!to) return
  msg.value = ''
  testLoading.value = true
  try {
    await testSmtpConfig(to)
    msg.value = t('settings.smtp.test.success')
  } catch (e) {
    msg.value = t('settings.smtp.error', { message: e.message })
  } finally {
    testLoading.value = false
  }
}
</script>
