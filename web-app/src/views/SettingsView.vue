<template>
  <div class="flex h-full">
    <!-- Vertikale Sub-Navigation (Desktop) -->
    <nav class="hidden lg:flex lg:flex-col lg:w-52 lg:shrink-0 border-r border-border px-3 py-6 gap-1">
      <RouterLink
        v-for="item in nav"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors"
        :class="isActive(item.to) ? 'bg-accent/85 text-accent-foreground' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'"
      >
        <component :is="item.icon" class="size-4 shrink-0" />
        {{ item.label }}
      </RouterLink>
    </nav>

    <!-- Horizontale Sub-Navigation (Mobile) -->
    <div class="lg:hidden w-full">
      <nav class="border-b border-border overflow-x-auto">
        <ul role="list" class="flex min-w-full gap-x-6 px-4 py-3 text-sm font-semibold text-muted-foreground">
          <li v-for="item in nav" :key="item.to">
            <RouterLink
              :to="item.to"
              :class="isActive(item.to) ? 'text-accent' : 'hover:text-foreground'"
              class="transition-colors whitespace-nowrap"
            >
              {{ item.label }}
            </RouterLink>
          </li>
        </ul>
      </nav>
      <RouterView />
    </div>

    <!-- Content (Desktop) -->
    <div class="hidden lg:block flex-1 min-w-0 overflow-y-auto">
      <RouterView />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { User, Monitor, HardDrive, Server, Users, Mail, RefreshCw } from 'lucide-vue-next'
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
  { to: '/settings/account', label: t('settings.account'), icon: User },
  { to: '/settings/display', label: t('settings.display'), icon: Monitor },
  { to: '/settings/backup', label: t('settings.backup'), icon: HardDrive },
  ...(isAdmin.value ? [{ to: '/settings/server', label: t('settings.server'), icon: Server }] : []),
  ...(isAdmin.value ? [{ to: '/settings/users', label: 'Benutzerverwaltung', icon: Users }] : []),
  ...(isAdmin.value ? [{ to: '/settings/smtp', label: t('settings.smtp'), icon: Mail }] : []),
  ...(isAdmin.value ? [{ to: '/settings/update', label: t('settings.update'), icon: RefreshCw }] : []),
])

function isActive(path) {
  return route.path === path || route.path.startsWith(path + '/')
}
</script>
