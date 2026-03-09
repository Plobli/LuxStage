<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="brand">LuxStage</h1>
      <form @submit.prevent="handleLogin">
        <div class="field">
          <label>{{ $t('auth.email') }}</label>
          <input v-model="email" type="email" autocomplete="email" required />
        </div>
        <div class="field">
          <label>{{ $t('auth.password') }}</label>
          <input v-model="password" type="password" autocomplete="current-password" required />
        </div>
        <p v-if="error" class="error-msg">{{ $t('auth.login.error') }}</p>
        <button type="submit" class="btn-primary" :disabled="loading">
          {{ loading ? '…' : $t('auth.login.submit') }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { login } from '../api/pocketbase.js'

const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref(false)
const loading = ref(false)

async function handleLogin() {
  error.value = false
  loading.value = true
  try {
    await login(email.value, password.value)
    router.push('/')
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}
</script>
