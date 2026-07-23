<template>
  <div class="flex min-h-full flex-1 flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <img src="/favicon.png" alt="LuxStage" class="mx-auto h-16 w-16 rounded-2xl" />
      <h1 class="mt-6 text-center text-xl font-semibold text-foreground">Passwort vergessen</h1>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-[480px]">
      <Card class="px-6 py-8 sm:px-12">

        <div v-if="done" class="space-y-4 text-center">
          <p class="text-sm text-muted-foreground">
            Falls ein Konto mit <strong>{{ email }}</strong> existiert, haben wir einen
            Link zum Zurücksetzen verschickt. Bitte prüfe dein Postfach.
          </p>
          <p class="text-xs text-muted-foreground">Der Link ist 1 Stunde gültig.</p>
          <RouterLink to="/login" class="inline-block text-sm text-primary hover:text-primary/80">
            ← Zur Anmeldung
          </RouterLink>
        </div>

        <form v-else class="space-y-6" @submit.prevent="handleSubmit">
          <p class="text-sm text-muted-foreground">
            Gib deine E-Mail-Adresse ein. Wir schicken dir einen Link, um ein neues
            Passwort zu vergeben.
          </p>
          <div class="space-y-2">
            <Label for="email">E-Mail</Label>
            <Input v-model="email" id="email" type="email" autocomplete="email" required />
          </div>

          <Alert v-if="error" variant="destructive">
            <AlertDescription>{{ error }}</AlertDescription>
          </Alert>

          <Button type="submit" :disabled="loading" class="w-full">
            {{ loading ? '…' : 'Link anfordern' }}
          </Button>

          <div class="text-center">
            <RouterLink to="/login" class="text-sm text-muted-foreground hover:text-foreground">
              Zurück zur Anmeldung
            </RouterLink>
          </div>
        </form>

      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { requestPasswordReset } from '../api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

const email = ref('')
const error = ref('')
const loading = ref(false)
const done = ref(false)

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    await requestPasswordReset(email.value)
    done.value = true
  } catch (e: any) {
    error.value = e?.message || 'Anfrage fehlgeschlagen.'
  } finally {
    loading.value = false
  }
}
</script>
