<template>
  <div class="flex min-h-full flex-1 flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <img src="/favicon.png" alt="LuxStage" class="mx-auto h-16 w-16 rounded-2xl" />
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px]">
      <div class="bg-gray-800/50 px-6 py-12 outline -outline-offset-1 outline-white/10 sm:rounded-lg sm:px-12">

        <!-- Login-Formular -->
        <form v-if="!showReset" class="space-y-6" @submit.prevent="handleLogin">
          <div>
            <label for="username" class="block text-sm/6 font-medium text-white">{{ t('auth.username') }}</label>
            <div class="mt-2">
              <input
                v-model="username"
                id="username"
                type="text"
                autocomplete="username"
                required
                class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-base text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-accent sm:text-sm/6"
              />
            </div>
          </div>

          <div>
            <label for="password" class="block text-sm/6 font-medium text-white">{{ t('auth.password') }}</label>
            <div class="mt-2">
              <input
                v-model="password"
                id="password"
                type="password"
                autocomplete="current-password"
                required
                class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-base text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-accent sm:text-sm/6"
              />
            </div>
          </div>

          <div v-if="error" class="text-sm text-red-400">{{ t('auth.login.error') }}</div>

          <div>
            <button
              type="submit"
              :disabled="loading"
              class="flex w-full justify-center rounded-md bg-accent px-3 py-1.5 text-sm/6 font-semibold text-white hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
            >
              {{ loading ? '…' : t('auth.login.submit') }}
            </button>
          </div>

          <div class="text-center">
            <button type="button" @click="showReset = true" class="text-sm text-gray-400 hover:text-white">
              {{ t('auth.reset') }}
            </button>
          </div>
        </form>

        <!-- Passwort-Reset-Hinweis -->
        <div v-else class="space-y-6">
          <h2 class="text-base/7 font-semibold text-white">{{ t('auth.reset.title') }}</h2>
          <p class="text-sm text-gray-400">{{ t('auth.reset.hint') }}</p>
          <button type="button" @click="showReset = false" class="text-sm text-accent hover:text-accent-hover">
            ← {{ t('auth.reset.back') }}
          </button>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { login } from '../api/client.js'
import { useLocale } from '../composables/useLocale.js'

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
