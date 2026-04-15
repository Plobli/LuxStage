<template>
  <div class="h-full bg-gray-950">
    <!-- Login-Route: kein Sidebar-Layout -->
    <RouterView v-if="route.meta.public" />

    <!-- App-Layout mit Sidebar -->
    <div v-else class="h-full bg-gray-950">
      <!-- Mobile Sidebar -->
      <Dialog :open="sidebarOpen" @update:open="sidebarOpen = $event" class="relative z-50 lg:hidden">
        <DialogContent class="fixed inset-y-0 left-0 flex w-full max-w-xs flex-1 p-0 border-0 rounded-none bg-transparent shadow-none" hideClose>
          <div class="absolute top-0 left-full flex w-16 justify-center pt-5">
            <button type="button" class="-m-2.5 p-2.5" @click="sidebarOpen = false">
              <span class="sr-only">Sidebar schließen</span>
              <X class="size-6 text-white" aria-hidden="true" />
            </button>
          </div>
          <div class="flex grow flex-col gap-y-5 overflow-y-auto bg-gray-950 px-6 pb-2 ring-1 ring-white/10">
            <div class="flex h-16 shrink-0 items-center">
              <img src="/favicon.png" alt="LuxStage" class="h-8 w-8 rounded-lg" />
              <span class="ml-3 text-lg font-bold text-white">LuxStage</span>
            </div>
            <nav class="flex flex-1 flex-col">
              <ul role="list" class="flex flex-1 flex-col gap-y-7">
                <li>
                  <ul role="list" class="-mx-2 space-y-1">
                    <li v-for="item in navigation" :key="item.name">
                      <RouterLink
                        :to="item.to"
                        class="group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold"
                        :class="isActiveRoute(item) ? 'bg-white/5 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'"
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
              <button
                @click="handleLogout"
                class="flex w-full items-center gap-x-4 px-6 py-3 text-sm/6 font-semibold text-gray-400 hover:bg-white/5 hover:text-white"
              >
                <LogOut class="size-5 shrink-0" aria-hidden="true" />
                {{ t('nav.logout') }}
              </button>
              <div class="px-6 text-xs text-gray-600">
                Web {{ appVersion }}<span v-if="serverVersion"> · Srv {{ serverVersion }}</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <!-- Desktop Sidebar (statisch, schmal – nur Icons) -->
      <div class="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-20 lg:overflow-y-auto lg:bg-gray-950 lg:pb-4 border-r border-white/10">
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
                :class="isActiveRoute(item) ? 'bg-white/5 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'"
              >
                <component :is="item.icon" class="size-6 shrink-0" aria-hidden="true" />
                <span v-if="item.badge?.value" class="absolute top-2 right-2 size-2 rounded-full bg-accent" />
                <span class="sr-only">{{ item.name }}</span>
              </RouterLink>
            </li>
          </ul>
        </nav>
        <div class="absolute bottom-0 left-0 right-0 pb-2 flex flex-col items-center gap-1">
          <button
            @click="handleLogout"
            :title="t('nav.logout')"
            class="p-3 text-gray-400 hover:bg-white/5 hover:text-white rounded-md"
          >
            <LogOut class="size-6 shrink-0" aria-hidden="true" />
            <span class="sr-only">{{ t('nav.logout') }}</span>
          </button>
          <div class="text-center leading-tight">
            <div class="text-[9px] text-gray-600">Web {{ appVersion }}</div>
            <div v-if="serverVersion" class="text-[9px] text-gray-600">Srv {{ serverVersion }}</div>
          </div>
        </div>
      </div>

      <!-- Mobile Top-Bar -->
      <div class="sticky top-0 z-40 flex items-center gap-x-6 bg-gray-950 px-4 py-4 shadow-xs sm:px-6 lg:hidden">
        <button type="button" class="-m-2.5 p-2.5 text-gray-400 lg:hidden" @click="sidebarOpen = true">
          <span class="sr-only">Sidebar öffnen</span>
          <Menu class="size-6" aria-hidden="true" />
        </button>
        <div class="flex items-center gap-2 flex-1">
          <img src="/favicon.png" alt="LuxStage" class="h-7 w-7 rounded-lg" />
          <span class="text-sm/6 font-semibold text-white">LuxStage</span>
        </div>
      </div>

      <!-- Main Content -->
      <main class="lg:pl-20 bg-gray-950 min-h-screen">
        <!-- Offline-Banner -->
        <div v-if="!isOnline" class="sticky top-0 z-50 flex items-center justify-center gap-2 bg-red-600 px-4 py-2 text-sm font-medium text-white">
          <svg class="size-4 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" clip-rule="evenodd" /></svg>
          {{ t('offline.banner') }}
        </div>
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
import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  Menu,
  X,
  LogOut,
  Layers,
  Archive,
  Files,
  Settings,
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

onMounted(async () => {
  await pingServer()
  pingInterval = setInterval(pingServer, 10_000)

  await checkForUpdate()
  updateCheckInterval = setInterval(checkForUpdate, 60 * 60 * 1000)
})

onUnmounted(() => {
  clearInterval(updateCheckInterval)
  clearInterval(pingInterval)
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
