<template>
  <div class="h-full bg-gray-950">
    <!-- Login-Route: kein Sidebar-Layout -->
    <RouterView v-if="route.meta.public" />

    <!-- App-Layout mit Sidebar -->
    <div v-else class="h-full bg-gray-950">
      <!-- Mobile Sidebar (Headless UI Dialog) -->
      <TransitionRoot as="template" :show="sidebarOpen">
        <Dialog class="relative z-50 lg:hidden" @close="sidebarOpen = false">
          <TransitionChild
            as="template"
            enter="transition-opacity ease-linear duration-300"
            enter-from="opacity-0"
            enter-to="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leave-from="opacity-100"
            leave-to="opacity-0"
          >
            <div class="fixed inset-0 bg-gray-950/80" />
          </TransitionChild>

          <div class="fixed inset-0 flex">
            <TransitionChild
              as="template"
              enter="transition ease-in-out duration-300 transform"
              enter-from="-translate-x-full"
              enter-to="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leave-from="translate-x-0"
              leave-to="-translate-x-full"
            >
              <DialogPanel class="relative mr-16 flex w-full max-w-xs flex-1">
                <div class="absolute top-0 left-full flex w-16 justify-center pt-5">
                  <button type="button" class="-m-2.5 p-2.5" @click="sidebarOpen = false">
                    <span class="sr-only">Sidebar schließen</span>
                    <XMarkIcon class="size-6 text-white" aria-hidden="true" />
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
                              <component :is="item.icon" class="size-6 shrink-0" aria-hidden="true" />
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
                      <ArrowLeftStartOnRectangleIcon class="size-5 shrink-0" aria-hidden="true" />
                      {{ t('nav.logout') }}
                    </button>
                  </div>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </TransitionRoot>

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
                class="group flex gap-x-3 rounded-md p-3 text-sm/6 font-semibold"
                :class="isActiveRoute(item) ? 'bg-white/5 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'"
              >
                <component :is="item.icon" class="size-6 shrink-0" aria-hidden="true" />
                <span class="sr-only">{{ item.name }}</span>
              </RouterLink>
            </li>
          </ul>
        </nav>
        <div class="absolute bottom-0 left-0 right-0 pb-4 flex justify-center">
          <button
            @click="handleLogout"
            :title="t('nav.logout')"
            class="p-3 text-gray-400 hover:bg-white/5 hover:text-white rounded-md"
          >
            <ArrowLeftStartOnRectangleIcon class="size-6 shrink-0" aria-hidden="true" />
            <span class="sr-only">{{ t('nav.logout') }}</span>
          </button>
        </div>
      </div>

      <!-- Mobile Top-Bar -->
      <div class="sticky top-0 z-40 flex items-center gap-x-6 bg-gray-950 px-4 py-4 shadow-xs sm:px-6 lg:hidden">
        <button type="button" class="-m-2.5 p-2.5 text-gray-400 lg:hidden" @click="sidebarOpen = true">
          <span class="sr-only">Sidebar öffnen</span>
          <Bars3Icon class="size-6" aria-hidden="true" />
        </button>
        <div class="flex items-center gap-2 flex-1">
          <img src="/favicon.png" alt="LuxStage" class="h-7 w-7 rounded-lg" />
          <span class="text-sm/6 font-semibold text-white">LuxStage</span>
        </div>
      </div>

      <!-- Main Content -->
      <main class="lg:pl-20 bg-gray-950 min-h-screen">
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
import { ref, watch } from 'vue'
import { RouterView, RouterLink, useRoute, useRouter } from 'vue-router'
import { Dialog, DialogPanel, TransitionChild, TransitionRoot } from '@headlessui/vue'
import {
  Bars3Icon,
  XMarkIcon,
  ArrowLeftStartOnRectangleIcon,
  RectangleStackIcon,
  DocumentDuplicateIcon,
  Cog6ToothIcon,
} from '@heroicons/vue/24/outline'
import { useLocale } from './composables/useLocale.js'
import { logout } from './api/client.js'
import ConfirmDialog from './components/ConfirmDialog.vue'
import { useConfirmDialog, resolveConfirm } from './composables/useConfirm.js'

const confirmState = useConfirmDialog()

const { t } = useLocale()
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
  { name: t('nav.shows'), to: '/', routeName: 'shows', icon: RectangleStackIcon },
  { name: t('nav.templates'), to: '/templates', routeName: 'templates', icon: DocumentDuplicateIcon },
  { name: t('nav.settings'), to: '/settings', routeName: 'settings', icon: Cog6ToothIcon },
]

async function handleLogout() {
  await logout()
  router.push('/login')
}
</script>
