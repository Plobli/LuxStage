<template>
  <div class="flex min-h-full flex-1 flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <img src="/favicon.png" alt="LuxStage" class="mx-auto h-16 w-16 rounded-2xl" />
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px]">
      <Card class="px-6 py-8 sm:px-12">

        <!-- Login-Formular -->
        <form v-if="!showReset" class="space-y-6" @submit.prevent="handleLogin">
          <div class="space-y-2">
            <Label for="username">{{ t('auth.username') }}</Label>
            <Input
              v-model="username"
              id="username"
              type="text"
              autocomplete="username"
              required
            />
          </div>

          <div class="space-y-2">
            <Label for="password">{{ t('auth.password') }}</Label>
            <Input
              v-model="password"
              id="password"
              type="password"
              autocomplete="current-password"
              required
            />
          </div>

          <Alert v-if="error" variant="destructive">
            <AlertDescription>{{ t('auth.login.error') }}</AlertDescription>
          </Alert>

          <Button
            type="submit"
            :disabled="loading"
            class="w-full"
          >
            {{ loading ? '…' : t('auth.login.submit') }}
          </Button>

          <div class="text-center">
            <Button variant="link" type="button" @click="showReset = true" class="text-sm text-muted-foreground hover:text-foreground">
              {{ t('auth.reset') }}
            </Button>
          </div>
        </form>

        <!-- Passwort-Reset-Hinweis -->
        <div v-else class="space-y-6">
          <h2 class="text-base/7 font-semibold text-foreground">{{ t('auth.reset.title') }}</h2>
          <p class="text-sm text-muted-foreground">{{ t('auth.reset.hint') }}</p>
          <Button variant="link" type="button" @click="showReset = false" class="text-sm p-0 h-auto text-primary hover:text-primary/80">
            ← {{ t('auth.reset.back') }}
          </Button>
        </div>

      </Card>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { login } from '../api/client.js'
import { useLocale } from '../composables/useLocale.js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

const router = useRouter()
const { t } = useLocale()
const username = ref('')
const password = ref('')
const error = ref(false)
const loading = ref(false)
const showReset = ref(false)

async function handleLogin() {
  error.value = false
  loading.value = true
  try {
    await login(username.value, password.value)
    router.push('/')
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}
</script>
