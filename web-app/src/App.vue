<template>
  <div class="app">
    <nav v-if="loggedIn" class="navbar">
      <span class="brand">LuxStage</span>
      <div class="nav-links">
        <RouterLink to="/">{{ $t('nav.shows') }}</RouterLink>
        <RouterLink to="/templates">{{ $t('nav.templates') }}</RouterLink>
        <RouterLink to="/settings">{{ $t('nav.settings') }}</RouterLink>
      </div>
      <button class="btn-ghost" @click="handleLogout">{{ $t('nav.logout') }}</button>
    </nav>
    <main>
      <RouterView />
    </main>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { pb, logout } from './api/pocketbase.js'

const router = useRouter()
const loggedIn = ref(pb.authStore.isValid)

const unsubscribe = pb.authStore.onChange(() => {
  loggedIn.value = pb.authStore.isValid
})
onUnmounted(unsubscribe)

function handleLogout() {
  logout()
  router.push('/login')
}
</script>
