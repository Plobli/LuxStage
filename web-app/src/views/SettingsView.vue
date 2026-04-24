<template>
  <div>
    <!-- Horizontale Sub-Navigation -->
    <header class="border-b border-border">
      <nav class="flex overflow-x-auto py-4">
        <ul role="list" class="flex min-w-full flex-none gap-x-6 px-4 text-sm/6 font-semibold text-muted-foreground sm:px-6 lg:px-8">
          <li v-for="item in nav" :key="item.to">
            <RouterLink
              :to="item.to"
              :class="isActive(item.to) ? 'text-accent' : 'hover:text-foreground'"
              class="transition-colors"
            >
              {{ item.label }}
            </RouterLink>
          </li>
        </ul>
      </nav>
    </header>

    <RouterView />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useLocale } from '../composables/useLocale.js'
import { jwtDecode } from '../api/jwtDecode.js'

const { t } = useLocale()
const route = useRoute()

const isAdmin = computed(() => {
  try {
    const token = localStorage.getItem('luxstage_token')
    return token ? jwtDecode(token)?.role === 'admin' : false
  } catch { return false }
})

const nav = computed(() => [
  { to: '/settings/account', label: t('settings.account') },
  { to: '/settings/display', label: t('settings.language') },
  { to: '/settings/backup', label: t('settings.backup') },
  ...(isAdmin.value ? [{ to: '/settings/server', label: t('settings.server') }] : []),
  ...(isAdmin.value ? [{ to: '/settings/users', label: 'Benutzerverwaltung' }] : []),
  ...(isAdmin.value ? [{ to: '/settings/smtp', label: t('settings.smtp') }] : []),
  ...(isAdmin.value ? [{ to: '/settings/update', label: t('settings.update') }] : []),
])

function isActive(path) {
  return route.path === path || route.path.startsWith(path + '/')
}
</script>
