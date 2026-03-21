<template>
  <div>
    <!-- Page Header -->
    <div class="sm:flex sm:items-center mb-8">
      <div class="sm:flex-auto">
        <h1 class="text-base font-semibold text-white">{{ t('nav.shows') }}</h1>
      </div>
      <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
        <button
          type="button"
          class="block rounded-md bg-accent px-3 py-2 text-center text-sm font-semibold text-white shadow-xs hover:bg-accent-hover"
          @click="drawerOpen = true"
        >
          {{ t('show.new') }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-sm text-gray-400">…</div>

    <!-- Leerer Zustand -->
    <div v-else-if="shows.length === 0" class="text-sm text-gray-400">{{ t('show.list.empty') }}</div>

    <!-- Gruppierte Show-Listen -->
    <template v-else>
      <div v-for="group in groupedShows" :key="group.template" class="mb-10">
        <h2 class="text-sm font-medium text-gray-400 mb-3">
          {{ templateDisplayName(group.template) || '—' }}
        </h2>
        <ul role="list" class="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          <li
            v-for="show in group.shows"
            :key="show.id"
            class="col-span-1 flex rounded-md shadow-xs cursor-pointer"
            @click="router.push(`/shows/${show.id}`)"
          >
            <div class="flex w-16 shrink-0 items-center justify-center rounded-l-md bg-gray-700 text-sm font-medium text-white">
              {{ initials(show.name || show.id) }}
            </div>
            <div class="flex flex-1 items-center justify-between truncate rounded-r-md border-t border-r border-b border-white/10 bg-gray-800/50">
              <div class="flex-1 truncate px-4 py-2 text-sm">
                <span class="font-medium text-white">{{ show.name || show.id }}</span>
                <p class="text-gray-400">{{ show.datum }}</p>
              </div>
              <div class="shrink-0 pr-2" @click.stop>
                <button
                  type="button"
                  class="inline-flex size-8 items-center justify-center rounded-full text-gray-400 hover:text-white focus:outline-none"
                  @click="archive(show.id)"
                  :title="t('show.archive')"
                >
                  <ArchiveBoxIcon class="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </template>

    <!-- Neue Show: Drawer -->
    <TransitionRoot as="template" :show="drawerOpen">
      <Dialog class="relative z-50" @close="drawerOpen = false">
        <TransitionChild
          as="template"
          enter="ease-in-out duration-500"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="ease-in-out duration-500"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-gray-900/80 transition-opacity" />
        </TransitionChild>
        <div class="fixed inset-0 overflow-hidden">
          <div class="absolute inset-0 overflow-hidden">
            <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <TransitionChild
                as="template"
                enter="transform transition ease-in-out duration-500"
                enter-from="translate-x-full"
                enter-to="translate-x-0"
                leave="transform transition ease-in-out duration-500"
                leave-from="translate-x-0"
                leave-to="translate-x-full"
              >
                <DialogPanel class="pointer-events-auto w-screen max-w-md">
                  <div class="flex h-full flex-col overflow-y-scroll bg-gray-900 py-6 shadow-xl ring-1 ring-white/10">
                    <div class="px-4 sm:px-6">
                      <div class="flex items-start justify-between">
                        <DialogTitle class="text-base font-semibold text-white">{{ t('show.new') }}</DialogTitle>
                        <div class="ml-3 flex h-7 items-center">
                          <button type="button" class="rounded-md text-gray-400 hover:text-white" @click="drawerOpen = false">
                            <span class="sr-only">Schließen</span>
                            <XMarkIcon class="size-6" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div class="relative mt-6 flex-1 px-4 sm:px-6">
                      <form @submit.prevent="handleCreate" class="space-y-6">
                        <div>
                          <label class="block text-sm/6 font-medium text-white">{{ t('show.name') }}</label>
                          <div class="mt-2">
                            <input
                              v-model="form.name"
                              type="text"
                              required
                              class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-accent"
                            />
                          </div>
                        </div>
                        <div>
                          <label class="block text-sm/6 font-medium text-white">{{ t('show.date') }}</label>
                          <div class="mt-2">
                            <input
                              v-model="form.datum"
                              type="date"
                              class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent"
                            />
                          </div>
                        </div>
                        <div>
                          <label class="block text-sm/6 font-medium text-white">{{ t('show.template') }}</label>
                          <div class="mt-2">
                            <select
                              v-model="form.template"
                              class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent"
                            >
                              <option value="" class="bg-gray-800">{{ t('show.template.none') }}</option>
                              <option v-for="tpl in templates" :key="tpl" :value="tpl" class="bg-gray-800">
                                {{ templateDisplayName(tpl) }}
                              </option>
                            </select>
                          </div>
                        </div>
                        <div class="flex justify-end gap-3 pt-4 border-t border-white/10">
                          <button
                            type="button"
                            class="rounded-md px-3 py-2 text-sm font-semibold text-gray-400 ring-1 ring-white/10 hover:ring-white/20"
                            @click="drawerOpen = false"
                          >
                            {{ t('action.cancel') }}
                          </button>
                          <button
                            type="submit"
                            :disabled="creating"
                            class="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
                          >
                            {{ creating ? '…' : t('show.create') }}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue'
import { XMarkIcon, ArchiveBoxIcon } from '@heroicons/vue/24/outline'
import { useLocale } from '../composables/useLocale.js'
import { fetchShows, createShow, archiveShow } from '../api/shows.js'
import { fetchTemplates, fetchTemplateChannels } from '../api/templates.js'
import { saveChannels } from '../api/channels.js'
import { fetchTemplateSections, saveShowSectionDefs } from '../api/sections.js'
import { templateDisplayName } from '../utils/templateName.js'

const router = useRouter()
const { t } = useLocale()

const shows = ref([])
const templates = ref([])
const loading = ref(true)
const creating = ref(false)
const drawerOpen = ref(false)
const form = ref({ name: '', datum: new Date().toISOString().slice(0, 10), template: '' })

function initials(name) {
  return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function generateId(name, datum) {
  const slug = name.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const year = datum ? datum.slice(0, 4) : new Date().getFullYear()
  return slug ? `${slug}-${year}` : ''
}

const groupedShows = computed(() => {
  const map = new Map()
  for (const show of shows.value) {
    const tpl = show.template || ''
    if (!map.has(tpl)) map.set(tpl, [])
    map.get(tpl).push(show)
  }
  return [...map.entries()].map(([template, s]) => ({ template, shows: s }))
})

onMounted(async () => {
  const [s, tpls] = await Promise.all([fetchShows(), fetchTemplates()])
  shows.value = s
  templates.value = tpls
  loading.value = false
})

async function handleCreate() {
  creating.value = true
  const id = generateId(form.value.name, form.value.datum)
  try {
    const content = `---\nid: ${id}\nname: ${form.value.name || id}\ndatum: ${form.value.datum || new Date().toISOString().slice(0, 10)}\n${form.value.template ? `template: ${form.value.template}\n` : ''}---\n\n`
    await createShow({ id, content, template: form.value.template || undefined })
    if (form.value.template) {
      const channels = await fetchTemplateChannels(form.value.template)
      if (channels.length) await saveChannels(id, channels)
      const secs = await fetchTemplateSections(form.value.template)
      if (secs.length) await saveShowSectionDefs(id, secs)
    }
    drawerOpen.value = false
    router.push(`/shows/${id}`)
  } finally {
    creating.value = false
  }
}

async function archive(id) {
  await archiveShow(id)
  shows.value = shows.value.filter(s => s.id !== id)
}
</script>
