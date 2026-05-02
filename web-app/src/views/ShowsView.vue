<template>
  <div class="px-4 py-10 sm:px-6 lg:px-8">
    <!-- Page Header -->
    <div class="sm:flex sm:items-center mb-8">
      <div class="sm:flex-auto">
        <h1 class="text-2xl font-semibold text-foreground">{{ t('nav.shows') }}</h1>
      </div>
      <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
        <Button @click="drawerOpen = true">
          {{ t('show.new') }}
        </Button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-sm text-muted-foreground">…</div>

    <!-- Leerer Zustand -->
    <div v-else-if="shows.length === 0" class="text-sm text-muted-foreground">{{ t('show.list.empty') }}</div>

    <!-- Gruppierte Show-Listen -->
    <template v-else>
      <div v-for="group in groupedShows" :key="group.template" class="mb-10">
        <h2 class="text-sm font-medium text-muted-foreground mb-3">
          {{ templateDisplayName(group.template) || '—' }}
        </h2>
        <ul role="list" class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <li
            v-for="show in group.shows"
            :key="show.id"
            class="col-span-1"
          >
            <Card class="flex h-full overflow-hidden cursor-pointer hover:bg-muted/50 transition-colors" @click="router.push(`/shows/${show.id}`)">
              <div class="flex w-16 shrink-0 items-center justify-center bg-secondary text-sm font-medium text-secondary-foreground border-r border-border">
                {{ initials(show.name || show.id) }}
              </div>
              <div class="flex flex-1 items-center justify-between truncate bg-card">
                <div class="flex-1 truncate px-4 py-3 text-sm">
                  <span class="font-medium text-foreground">{{ show.name || show.id }}</span>
                  <p class="text-muted-foreground">{{ show.datum }}</p>
                  <p v-if="show.last_edited_by" class="text-muted-foreground text-xs mt-1 truncate">
                    {{ show.last_edited_by }}, {{ formatEditedAt(show.last_edited_at) }}
                  </p>
                </div>
                <div class="shrink-0 pr-4" @click.stop>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="text-muted-foreground hover:text-foreground"
                    @click="archive(show.id)"
                    :title="t('show.archive')"
                  >
                    <Archive class="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </Card>
          </li>
        </ul>
      </div>
    </template>

    <!-- Neue Show: Dialog -->
    <Dialog :open="drawerOpen" @update:open="drawerOpen = $event">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ t('show.new') }}</DialogTitle>
        </DialogHeader>
        <form @submit.prevent="handleCreate" class="space-y-6 mt-4">
          <div class="space-y-2">
            <Label for="showName">{{ t('show.name') }}</Label>
            <Input
              id="showName"
              v-model="form.name"
              type="text"
              required
            />
          </div>
          <div class="space-y-2">
            <Label for="showDate">{{ t('show.date') }}</Label>
            <Input
              id="showDate"
              v-model="form.datum"
              type="date"
            />
          </div>
          <div class="space-y-2">
            <Label for="showTemplate">{{ t('show.template') }}</Label>
            <Select id="showTemplate" v-model="form.template">
              <SelectTrigger class="w-full">
                <SelectValue :placeholder="t('show.template.none')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{{ t('show.template.none') }}</SelectItem>
                <SelectItem v-for="tpl in templates" :key="tpl.name" :value="tpl.name">
                  {{ templateDisplayName(tpl.name) }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter class="pt-4">
            <Button variant="outline" type="button" @click="drawerOpen = false">
              {{ t('action.cancel') }}
            </Button>
            <Button type="submit" :disabled="creating">
              <Loader2 v-if="creating" class="mr-2 size-4 animate-spin" />
              {{ creating ? t('show.creating') : t('show.create') }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Archive, Loader2 } from 'lucide-vue-next'
import { useLocale } from '../composables/useLocale.js'
import { fetchShows, createShow, archiveShow } from '../api/shows.js'
import { fetchTemplates, fetchTemplateChannels } from '../api/templates.js'
import { cached, invalidate } from '../api/cache.js'
import { saveChannels } from '../api/channels.js'
import { templateDisplayName } from '../utils/templateName.js'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const router = useRouter()
const { t } = useLocale()

const shows = ref([])
const templates = ref([])
const loading = ref(true)
const creating = ref(false)
const drawerOpen = ref(false)
const form = ref({ name: '', datum: new Date().toISOString().slice(0, 10), template: '' })

function formatEditedAt(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ', ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

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
  const sorted = [...shows.value].sort((a, b) => {
    const tplA = (a.template || '').toLowerCase()
    const tplB = (b.template || '').toLowerCase()
    if (tplA < tplB) return -1
    if (tplA > tplB) return 1
    return (b.datum || '').localeCompare(a.datum || '')
  })
  const groups = []
  const seen = new Map()
  for (const show of sorted) {
    const tpl = show.template || ''
    if (seen.has(tpl)) {
      groups[seen.get(tpl)].shows.push(show)
    } else {
      seen.set(tpl, groups.length)
      groups.push({ template: tpl, shows: [show] })
    }
  }
  return groups
})

onMounted(async () => {
  const [s, tpls] = await Promise.all([
    cached('shows', fetchShows),
    cached('templates', fetchTemplates),
  ])
  shows.value = s
  templates.value = tpls
  loading.value = false
})

async function handleCreate() {
  creating.value = true
  const id = generateId(form.value.name, form.value.datum)
  try {
    const content = `---\nid: ${id}\nname: ${form.value.name || id}\ndatum: ${form.value.datum || new Date().toISOString().slice(0, 10)}\n${form.value.template ? `template: ${form.value.template}\n` : ''}---\n\n`
    await createShow({ id, name: form.value.name || id, datum: form.value.datum || new Date().toISOString().slice(0, 10), content, template: form.value.template || undefined })
    invalidate('shows')
    const newShow = { id, name: form.value.name || id, datum: form.value.datum || new Date().toISOString().slice(0, 10), template: form.value.template || '' }
    shows.value.push(newShow)
    if (form.value.template) {
      try {
        const channels = await fetchTemplateChannels(form.value.template)
        if (channels.length) await saveChannels(id, channels)
      } catch (e) {
        console.error('Failed to apply template channels:', e)
      }
    }
    drawerOpen.value = false
    router.push(`/shows/${id}`)
  } catch (e) {
    console.error('Failed to create show:', e)
  } finally {
    creating.value = false
  }
}

async function archive(showId) {
  const idx = shows.value.findIndex(s => s.id === showId)
  const removed = shows.value.splice(idx, 1)[0]
  try {
    await archiveShow(showId)
    invalidate('shows')
  } catch (e) {
    console.error('Failed to archive show:', e)
    shows.value.splice(idx, 0, removed)
  }
}
</script>
