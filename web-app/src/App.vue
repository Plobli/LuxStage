<template>
  <div class="app">
    <nav v-if="loggedIn" class="navbar">
      <span class="brand">LuxStage</span>
      <div class="nav-links">
        <RouterLink to="/">{{ t('nav.shows') }}</RouterLink>
        <RouterLink to="/templates">{{ t('nav.templates') }}</RouterLink>
        <RouterLink to="/settings">{{ t('nav.settings') }}</RouterLink>
      </div>
      <button class="btn-ghost" @click="handleLogout">{{ t('nav.logout') }}</button>
    </nav>
    <main>
      <RouterView />
    </main>
  </div>
</template>

<script setup>
import { ref, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { isLoggedIn, logout } from './api/client.js'
import { useLocale } from './composables/useLocale.js'

const router = useRouter()
const { t } = useLocale()
const loggedIn = ref(isLoggedIn())

// Token kann sich durch Login/Logout ändern
watchEffect(() => { loggedIn.value = isLoggedIn() })

function handleLogout() {
  logout()
  router.push('/login')
}
</script>
