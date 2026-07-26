<template>
  <div class="flex min-h-full flex-1 flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <img src="/favicon.png" alt="LuxStage" class="mx-auto h-16 w-16 rounded-2xl" />
      <h1 class="mt-6 text-center text-xl font-semibold text-foreground">Neues Passwort</h1>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-[480px]">
      <Card class="px-6 py-8 sm:px-12">

        <div v-if="done" class="space-y-4 text-center">
          <h2 class="text-base font-semibold text-foreground">Passwort geändert ✓</h2>
          <p class="text-sm text-muted-foreground">Du kannst dich jetzt mit deinem neuen Passwort anmelden.</p>
          <RouterLink to="/login" class="inline-block text-sm text-primary hover:text-primary/80">
            → Zur Anmeldung
          </RouterLink>
        </div>

        <div v-else-if="!token" class="space-y-4 text-center">
          <Alert variant="destructive" class="text-left">
            <AlertDescription>Kein gültiger Reset-Link. Bitte fordere einen neuen an.</AlertDescription>
          </Alert>
          <RouterLink to="/forgot-password" class="inline-block text-sm text-primary hover:text-primary/80">
            ← Passwort vergessen
          </RouterLink>
        </div>

        <form v-else class="space-y-6" @submit.prevent="handleSubmit">
          <div class="space-y-2">
            <Label for="pw">Neues Passwort</Label>
            <Input v-model="password" id="pw" type="password" autocomplete="new-password" required />
            <p class="text-xs text-muted-foreground">Mindestens {{ PASSWORD_MIN_LENGTH }} Zeichen.</p>
          </div>
          <div class="space-y-2">
            <Label for="pw2">Passwort wiederholen</Label>
            <Input v-model="password2" id="pw2" type="password" autocomplete="new-password" required />
          </div>

          <Alert v-if="error" variant="destructive">
            <AlertDescription>{{ error }}</AlertDescription>
          </Alert>

          <Button type="submit" :disabled="loading" class="w-full">
            {{ loading ? '…' : 'Passwort setzen' }}
          </Button>
        </form>

      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { confirmPasswordReset } from '../api/client'
import { PASSWORD_MIN_LENGTH } from '@shared/constants.js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

const route = useRoute()
const token = ref(String(route.query.token || ''))
const password = ref('')
const password2 = ref('')
const error = ref('')
const loading = ref(false)
const done = ref(false)

async function handleSubmit() {
  error.value = ''
  if (password.value.length < PASSWORD_MIN_LENGTH) { error.value = `Passwort zu kurz (min. ${PASSWORD_MIN_LENGTH} Zeichen).`; return }
  if (password.value !== password2.value) { error.value = 'Passwörter stimmen nicht überein.'; return }
  loading.value = true
  try {
    await confirmPasswordReset(token.value, password.value)
    done.value = true
  } catch (e: any) {
    error.value = e?.message || 'Zurücksetzen fehlgeschlagen.'
  } finally {
    loading.value = false
  }
}
</script>
