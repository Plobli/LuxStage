<template>
  <div class="flex min-h-full flex-1 flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <img src="/favicon.png" alt="LuxStage" class="mx-auto h-16 w-16 rounded-2xl" />
      <h1 class="mt-6 text-center text-xl font-semibold text-foreground">Team registrieren</h1>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-[480px]">
      <Card class="px-6 py-8 sm:px-12">

        <!-- Erfolg: Opt-In-Hinweis -->
        <div v-if="done" class="space-y-4 text-center">
          <h2 class="text-base font-semibold text-foreground">Fast geschafft</h2>
          <p class="text-sm text-muted-foreground">
            Wir haben eine Bestätigungs-E-Mail an <strong>{{ email }}</strong> geschickt.
            Bitte klicke auf den Link darin, um dein Team <strong>{{ teamId }}</strong> zu aktivieren.
          </p>
          <p class="text-xs text-muted-foreground">Der Link ist 24 Stunden gültig.</p>
          <RouterLink to="/login" class="inline-block text-sm text-primary hover:text-primary/80">
            ← Zur Anmeldung
          </RouterLink>
        </div>

        <!-- Registrierungs-Formular -->
        <form v-else class="space-y-6" @submit.prevent="handleRegister">
          <div class="space-y-2">
            <Label for="teamId">Team-Kürzel</Label>
            <Input
              v-model="teamId"
              id="teamId"
              type="text"
              autocomplete="off"
              placeholder="z. B. buehne-nord"
              required
            />
            <p class="text-xs text-muted-foreground">
              Wird zu deiner Adresse: <span class="font-mono">{{ teamId || 'kuerzel' }}.luxstage.app</span>
            </p>
          </div>

          <div class="space-y-2">
            <Label for="email">E-Mail</Label>
            <Input
              v-model="email"
              id="email"
              type="email"
              autocomplete="email"
              required
            />
          </div>

          <div class="space-y-2">
            <Label for="password">Passwort</Label>
            <Input
              v-model="password"
              id="password"
              type="password"
              autocomplete="new-password"
              required
            />
            <p class="text-xs text-muted-foreground">Mindestens 8 Zeichen.</p>
          </div>

          <Alert v-if="error" variant="destructive">
            <AlertDescription>{{ error }}</AlertDescription>
          </Alert>

          <Button type="submit" :disabled="loading" class="w-full">
            {{ loading ? '…' : 'Registrieren' }}
          </Button>

          <div class="text-center">
            <RouterLink to="/login" class="text-sm text-muted-foreground hover:text-foreground">
              Bereits ein Team? Anmelden
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
import { register } from '../api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

const teamId = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const done = ref(false)

// Team-Kürzel live normalisieren: Kleinbuchstaben, nur a-z 0-9 Bindestrich.
function normalizeTeamId(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9-]/g, '')
}

async function handleRegister() {
  error.value = ''
  teamId.value = normalizeTeamId(teamId.value)
  if (teamId.value.length < 2) { error.value = 'Team-Kürzel zu kurz (min. 2 Zeichen).'; return }
  if (password.value.length < 8) { error.value = 'Passwort zu kurz (min. 8 Zeichen).'; return }
  loading.value = true
  try {
    await register(teamId.value, email.value, password.value)
    done.value = true
  } catch (e: any) {
    error.value = e?.message || 'Registrierung fehlgeschlagen.'
  } finally {
    loading.value = false
  }
}
</script>
