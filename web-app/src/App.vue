<template>
  <div class="h-full bg-background">
    <!-- Login-Route: kein Sidebar-Layout -->
    <RouterView v-if="route.meta.public" />

    <!-- App-Layout mit Sidebar -->
    <div v-else class="h-full bg-background">
      <!-- Mobile Sidebar -->
      <Transition name="fade">
        <div v-if="sidebarOpen" class="relative z-50 lg:hidden" @keydown.esc="sidebarOpen = false">
          <Transition name="fade">
            <div v-if="sidebarOpen" class="fixed inset-0 bg-background/80 backdrop-blur-sm" @click="sidebarOpen = false" />
          </Transition>

          <div class="fixed inset-0 flex">
            <Transition name="slide">
              <div v-if="sidebarOpen" class="relative flex w-full max-w-xs flex-1">
                <div class="absolute top-0 left-full flex w-16 justify-center pt-5">
                  <Button variant="ghost" size="icon" class="-m-2.5 p-2.5" @click="sidebarOpen = false">
                    <span class="sr-only">Sidebar schließen</span>
                    <X class="size-6 text-foreground" aria-hidden="true" />
                  </Button>
                </div>
                <div class="flex grow flex-col gap-y-5 overflow-y-auto bg-background px-6 pb-2 border-r border-border">
                  <div class="flex h-16 shrink-0 items-center">
                    <img src="/favicon.png" alt="LuxStage" class="h-8 w-8 rounded-lg" />
                    <span class="ml-3 text-lg font-bold text-foreground">LuxStage</span>
                  </div>
                  <nav class="flex flex-1 flex-col">
                    <ul role="list" class="flex flex-1 flex-col gap-y-7">
                      <li>
                        <ul role="list" class="-mx-2 space-y-1">
                          <li v-for="item in navigation" :key="item.name">
                            <RouterLink
                              :to="item.to"
                              class="group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold"
                              :class="isActiveRoute(item) ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                            >
                              <span class="relative shrink-0">
                                <component :is="item.icon" class="size-6" aria-hidden="true" />
                                <span v-if="item.badge?.value" class="absolute -top-1 -right-1 size-2 rounded-full bg-accent" />
                              </span>
                              {{ item.name }}
                            </RouterLink>
                          </li>
                        </ul>
                      </li>
                    </ul>
                  </nav>
                  <div class="-mx-6 pb-4 mt-auto">
                    <Button
                      variant="ghost"
                      @click="handleLogout"
                      class="flex w-full justify-start items-center gap-x-4 px-6 py-6 text-sm/6 font-semibold text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-none"
                    >
                      <LogOut class="size-5 shrink-0" aria-hidden="true" />
                      {{ t('nav.logout') }}
                    </Button>
                    <div class="px-6 mt-2 text-xs text-muted-foreground/60">
                      Web {{ appVersion }}<span v-if="serverVersion"> · Srv {{ serverVersion }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </Transition>

      <!-- Desktop Sidebar (statisch, schmal – nur Icons) -->
      <div class="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-20 lg:overflow-y-auto lg:bg-background lg:pb-4 border-r border-border">
        <div class="flex h-16 shrink-0 items-center justify-center">
          <img src="/favicon.png" alt="LuxStage" class="h-9 w-9 rounded-xl" />
        </div>
        <nav class="mt-8">
          <ul role="list" class="flex flex-col items-center space-y-1">
            <li v-for="item in navigation" :key="item.name">
              <RouterLink
                :to="item.to"
                :title="item.name"
                class="group relative flex gap-x-3 rounded-md p-3 text-sm/6 font-semibold"
                :class="isActiveRoute(item) ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
              >
                <component :is="item.icon" class="size-6 shrink-0" aria-hidden="true" />
                <span v-if="item.badge?.value" class="absolute top-2 right-2 size-2 rounded-full bg-accent" />
                <span class="sr-only">{{ item.name }}</span>
              </RouterLink>
            </li>
          </ul>
        </nav>
        <div class="absolute bottom-0 left-0 right-0 pb-2 flex flex-col items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            @click="handleLogout"
            :title="t('nav.logout')"
            class="size-12 text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md"
          >
            <LogOut class="size-6 shrink-0" aria-hidden="true" />
            <span class="sr-only">{{ t('nav.logout') }}</span>
          </Button>
          <div class="text-center leading-tight">
            <div class="text-[9px] text-muted-foreground/60">Web {{ appVersion }}</div>
            <div v-if="serverVersion" class="text-[9px] text-muted-foreground/60">Srv {{ serverVersion }}</div>
          </div>
        </div>
      </div>

      <!-- Mobile Top-Bar -->
      <div class="sticky top-0 z-40 flex items-center gap-x-6 bg-background px-4 py-4 shadow-xs sm:px-6 lg:hidden border-b border-border">
        <Button variant="ghost" size="icon" class="-m-2.5 p-2.5 text-muted-foreground lg:hidden" @click="sidebarOpen = true">
          <span class="sr-only">Sidebar öffnen</span>
          <Menu class="size-6" aria-hidden="true" />
        </Button>
        <div class="flex items-center gap-2 flex-1">
          <img src="/favicon.png" alt="LuxStage" class="h-7 w-7 rounded-lg" />
          <span class="text-sm/6 font-semibold text-foreground">LuxStage</span>
        </div>
      </div>

      <!-- Main Content -->
      <main class="lg:pl-20 bg-background min-h-screen">
        <!-- Offline-Banner -->
        <Alert v-if="!isOnline" variant="destructive" class="sticky top-0 z-50 rounded-none border-x-0 border-t-0 py-2">
          <AlertTriangle class="size-4" />
          <AlertDescription>{{ t('offline.banner') }}</AlertDescription>
        </Alert>
        <RouterView />

      </main>
    </div>
    <!-- Global Confirm Dialog -->
    <ConfirmDialog
      :open="confirmState.open.value"
      :title="confirmState.title.value"
      :message="confirmState.message.value"
      :confirmLabel="confirmState.confirmLabel.value"
      :cancelLabel="confirmState.cancelLabel.value"
      @confirm="resolveConfirm(true)"
      @cancel="resolveConfirm(false)"
    />
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { RouterView, RouterLink, useRoute, useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Menu,
  X,
  LogOut,
  Layers,
  Archive,
  Files,
  Settings,
  AlertTriangle,
} from 'lucide-vue-next'
import { useLocale } from './composables/useLocale.js'
import { logout, api, isOnline, BASE } from './api/client.js'
import { useTokenRefresh } from './composables/useTokenRefresh.js'
import { jwtDecode } from './api/jwtDecode.js'
import { updateAvailable } from './composables/useUpdateCheck.js'
import ConfirmDialog from './components/ConfirmDialog.vue'
import { useConfirmDialog, resolveConfirm } from './composables/useConfirm.js'

const confirmState = useConfirmDialog()
useTokenRefresh()

const { t } = useLocale()
const appVersion = __APP_VERSION__
const serverVersion = ref(null)

async function pingServer() {
  try {
    const status = await api.get('/api/status')
    isOnline.value = true
    serverVersion.value = status.version
  } catch {
    isOnline.value = false
  }
}

async function checkForUpdate() {
  try {
    const token = localStorage.getItem('luxstage_token')
    const isAdmin = token && jwtDecode(token)?.role === 'admin'
    if (!isAdmin) return
    const check = await api.get('/api/update/check')
    if (check?.available) updateAvailable.value = true
  } catch {}
}

let updateCheckInterval = null
let pingInterval = null

onUnmounted(() => {
  clearInterval(updateCheckInterval)
  clearInterval(pingInterval)
})

onMounted(() => {
  void pingServer()
  pingInterval = setInterval(pingServer, 10_000)

  void checkForUpdate()
  updateCheckInterval = setInterval(checkForUpdate, 60 * 60 * 1000)
})
const route = useRoute()
const router = useRouter()
const sidebarOpen = ref(false)

watch(route, () => { sidebarOpen.value = false })

function isActiveRoute(item) {
  if (item.to === '/') {
    return route.path === '/' || route.path.startsWith('/shows')
  }
  return route.path.startsWith(item.to)
}

const navigation = [
  { name: t('nav.shows'), to: '/', routeName: 'shows', icon: Layers },
  { name: t('nav.archive'), to: '/archive', routeName: 'archive', icon: Archive },
  { name: t('nav.templates'), to: '/templates', routeName: 'templates', icon: Files },
  { name: t('nav.settings'), to: '/settings', routeName: 'settings', icon: Settings, badge: updateAvailable },
]

async function handleLogout() {
  await logout()
  router.push('/login')
}
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s linear;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.2s ease-in-out;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(-100%);
}
</style>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s linear;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.2s ease-in-out;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(-100%);
}
</style>
