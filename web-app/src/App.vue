<template>
  <div class="h-full bg-background pt-[env(safe-area-inset-top)]">
    <!-- Login-Route: kein Sidebar-Layout -->
    <RouterView v-if="route.meta.public" />

    <!-- App-Layout mit Sidebar -->
    <div v-else class="h-full bg-background">
      <!-- Mobile Sidebar -->
      <Transition name="fade">
        <div v-if="sidebarOpen" class="relative z-50 md:hidden" @keydown.esc="sidebarOpen = false">
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
                    <div class="px-6 mt-2 text-xs text-muted-foreground/80">
                      Web {{ appVersion }}<span v-if="serverVersion"> · Srv {{ serverVersion }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </Transition>

      <!-- Desktop Sidebar -->
      <div
        class="hidden md:fixed md:inset-y-0 md:left-0 md:z-50 md:flex md:flex-col md:overflow-y-auto md:pb-4 overflow-x-hidden border-r border-border bg-surface-high transition-[width] duration-300 ease-in-out"
        :class="sidebarExpanded ? 'md:w-64' : 'md:w-20'"
        @mouseenter="onSidebarEnter"
        @mouseleave="onSidebarLeave"
      >
        <!-- Logo -->
        <div class="flex h-16 shrink-0 items-center px-3 gap-3 overflow-hidden">
          <img src="/favicon.png" alt="LuxStage" class="h-9 w-9 rounded-xl shrink-0" />
          <span class="text-sm font-bold text-foreground whitespace-nowrap transition-[opacity,max-width] duration-300 ease-in-out overflow-hidden flex-1" :class="sidebarExpanded ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'">LuxStage</span>
          <button
            v-if="sidebarExpanded"
            @click="togglePin"
            :title="sidebarPinned ? 'Sidebar lösen' : 'Sidebar feststellen'"
            class="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent/85 hover:text-accent-foreground"
          >
            <PinOff v-if="sidebarPinned" class="size-4" />
            <Pin v-else class="size-4" />
          </button>
        </div>

        <!-- Hauptnavigation -->
        <nav class="mt-2 flex-1">
          <ul role="list" class="flex flex-col gap-1 px-2">
            <li v-for="item in navigation" :key="item.name" class="w-full">
              <RouterLink
                :to="item.to"
                :title="sidebarExpanded ? undefined : item.name"
                class="group relative flex items-center gap-3 rounded-lg px-3 py-1.5 w-full transition-colors"
                :class="[isActiveRoute(item) ? 'text-accent-foreground' : 'text-muted-foreground', sidebarExpanded && isActiveRoute(item) ? 'bg-accent/85' : '', sidebarExpanded && !isActiveRoute(item) ? 'nav-hover' : '']"
              >
                <div class="shrink-0 rounded-md p-1.5 transition-colors" :class="!sidebarExpanded ? (isActiveRoute(item) ? 'bg-accent/85' : 'group-hover:bg-accent/85') : ''">
                  <component :is="item.icon" class="size-5" aria-hidden="true" />
                </div>
                <span v-if="item.badge?.value" class="absolute top-1 right-1 size-2 rounded-full bg-accent" />
                <span class="text-sm font-medium whitespace-nowrap transition-[opacity,max-width] duration-300 ease-in-out overflow-hidden" :class="sidebarExpanded ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'">{{ item.name }}</span>
              </RouterLink>

              <!-- Show-Sub-Nav unterhalb von Shows -->
              <Transition name="subnav">
                <div v-if="item.to === '/' && isShowDetail && navItems.length" class="mt-1 ml-2 border-l border-border/30 pl-1 flex flex-col gap-0.5 items-stretch">
                  <template v-for="sub in navItems" :key="sub.key ?? sub.type + sub.label">
                    <div v-if="sub.type === 'group'" />
                    <button
                      v-else-if="sub.type === 'addSection'"
                      class="group relative flex items-center gap-3 rounded-lg px-3 py-1.5 w-full text-muted-foreground hover:text-accent-foreground transition-colors"
                      :class="sidebarExpanded ? 'nav-hover' : ''"
                      :title="sidebarExpanded ? undefined : sub.label"
                      @click="showNavAddSection()"
                    >
                      <div class="shrink-0 rounded-md p-1.5 transition-colors" :class="!sidebarExpanded ? 'group-hover:bg-accent/85' : ''">
                        <Plus class="size-5" />
                      </div>
                      <span class="text-sm whitespace-nowrap transition-[opacity,max-width] duration-300 ease-in-out overflow-hidden" :class="sidebarExpanded ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'">{{ sub.label }}</span>
                    </button>
                    <button
                      v-else
                      class="group relative flex items-center gap-3 rounded-lg px-3 py-1.5 w-full transition-colors"
                      :class="[sub.active ? 'text-accent-foreground' : 'text-muted-foreground', sidebarExpanded ? (sub.active ? 'bg-accent/85' : 'nav-hover') : '']"
                      :title="sidebarExpanded ? undefined : sub.label"
                      @click="showNavNavigate(sub)"
                    >
                      <div class="shrink-0 rounded-md p-1.5 transition-colors" :class="!sidebarExpanded ? (sub.active ? 'bg-accent/85' : 'group-hover:bg-accent/85') : ''">
                        <component :is="sub.icon" class="size-5" />
                      </div>
                      <span class="text-sm whitespace-nowrap transition-[opacity,max-width] duration-300 ease-in-out overflow-hidden" :class="sidebarExpanded ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'">{{ sub.label }}</span>
                    </button>
                  </template>
                </div>
              </Transition>
            </li>
          </ul>
        </nav>

        <!-- Settings + Logout -->
        <div class="flex flex-col gap-1 px-2">
          <RouterLink
            to="/settings"
            :title="sidebarExpanded ? undefined : t('nav.settings')"
            class="group relative flex items-center gap-3 rounded-lg px-3 py-1.5 w-full transition-colors overflow-hidden"
            :class="[route.path.startsWith('/settings') ? 'text-accent-foreground' : 'text-muted-foreground', sidebarExpanded ? (route.path.startsWith('/settings') ? 'bg-accent/85' : 'nav-hover') : '']"
          >
            <div class="shrink-0 rounded-md p-1.5 transition-colors" :class="!sidebarExpanded ? (route.path.startsWith('/settings') ? 'bg-accent/85' : 'group-hover:bg-accent/85') : ''">
              <Settings class="size-5" aria-hidden="true" />
            </div>
            <span v-if="updateAvailable" class="absolute top-1 right-1 size-2 rounded-full bg-accent" />
            <span class="text-sm font-medium whitespace-nowrap transition-[opacity,max-width] duration-300 ease-in-out overflow-hidden" :class="sidebarExpanded ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'">{{ t('nav.settings') }}</span>
          </RouterLink>
          <button
            @click="handleLogout"
            :title="sidebarExpanded ? undefined : t('nav.logout')"
            class="group flex items-center gap-3 rounded-lg px-3 py-1.5 w-full text-muted-foreground hover:text-accent-foreground transition-colors overflow-hidden"
            :class="sidebarExpanded ? 'nav-hover' : ''"
          >
            <div class="shrink-0 rounded-md p-1.5 transition-colors" :class="!sidebarExpanded ? 'group-hover:bg-accent/85' : ''">
              <LogOut class="size-5" aria-hidden="true" />
            </div>
            <span class="text-sm font-medium whitespace-nowrap transition-[opacity,max-width] duration-300 ease-in-out overflow-hidden" :class="sidebarExpanded ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'">{{ t('nav.logout') }}</span>
          </button>
        </div>
      </div>

      <!-- Mobile Top-Bar -->
      <div class="sticky top-0 z-40 flex items-center gap-x-6 bg-background px-4 py-4 shadow-xs sm:px-6 md:hidden border-b border-border">
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
      <main class="bg-background h-dvh overflow-y-auto transition-[padding] duration-300 ease-in-out" :class="sidebarPinned ? 'md:pl-64' : 'md:pl-24'">
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
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
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
  Pin,
  PinOff,
} from 'lucide-vue-next'
import { useLocale } from './composables/useLocale.js'
import { logout, api, isOnline, BASE } from './api/client.js'
import { useTokenRefresh } from './composables/useTokenRefresh.js'
import { jwtDecode } from './api/jwtDecode.js'
import { updateAvailable } from './composables/useUpdateCheck.js'
import ConfirmDialog from './components/ConfirmDialog.vue'
import { useConfirmDialog, resolveConfirm } from './composables/useConfirm.js'
import { useShowNav } from './composables/useShowNav.js'
import { Plus } from 'lucide-vue-next'

const confirmState = useConfirmDialog()
const { navItems, navigate: showNavNavigate, addSection: showNavAddSection } = useShowNav()
const isShowDetail = computed(() => route.path.startsWith('/shows/') && route.path !== '/shows')
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
  } catch (e) {
    console.warn('[LuxStage] Update-Check fehlgeschlagen:', e)
  }
}

let updateCheckInterval = null
let pingInterval = null

onUnmounted(() => {
  clearInterval(updateCheckInterval)
  clearInterval(pingInterval)
})

onMounted(async () => {
  void pingServer()
  pingInterval = setInterval(pingServer, 30_000) // 30 s statt 10 s – weniger Last bei vielen gleichzeitigen Clients

  void checkForUpdate()
  updateCheckInterval = setInterval(checkForUpdate, 60 * 60 * 1000)

  try {
    const prefs = await api.get('/api/me/preferences')
    sidebarPinned.value = prefs.sidebarPinned
    sidebarExpanded.value = prefs.sidebarPinned
  } catch { /* ignorieren */ }
})
const route = useRoute()
const router = useRouter()
const sidebarOpen = ref(false)
const sidebarPinned = ref(false)
const sidebarExpanded = ref(false)

function togglePin() {
  sidebarPinned.value = !sidebarPinned.value
  sidebarExpanded.value = sidebarPinned.value
  api.patch('/api/me/preferences', { sidebarPinned: sidebarPinned.value }).catch(() => {})
}

function onSidebarEnter() { if (!sidebarPinned.value) sidebarExpanded.value = true }
function onSidebarLeave() { if (!sidebarPinned.value) sidebarExpanded.value = false }

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


.nav-hover:hover {
  background-color: hsl(var(--accent) / 0.85);
  color: hsl(var(--accent-foreground));
}

.subnav-enter-active,
.subnav-leave-active {
  transition: opacity 0.25s ease, max-height 0.3s ease;
  max-height: 600px;
  overflow: hidden;
}
.subnav-enter-from,
.subnav-leave-to {
  opacity: 0;
  max-height: 0;
}

</style>
