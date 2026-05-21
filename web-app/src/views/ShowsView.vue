<template>
  <div class="px-4 py-10 sm:px-6 lg:px-8">
    <!-- Page Header -->
    <div class="sm:flex sm:items-center mb-8">
      <div class="sm:flex-auto">
        <h1 class="text-2xl font-semibold text-foreground">{{ t('nav.shows') }}</h1>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-sm text-muted-foreground">…</div>

    <!-- Leerer Zustand -->
    <div v-else-if="shows.length === 0" class="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <p class="text-muted-foreground text-sm">{{ t('show.list.empty') }}</p>
      <Button variant="accent" @click="openCreate" class="flex items-center gap-2">
        <Plus class="size-4" />
        {{ t('show.create') }}
      </Button>
    </div>

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
                  <p v-if="show.datum" class="text-muted-foreground">Stand: {{ show.datum }}</p>
                  <p v-if="show.last_edited_by" class="text-muted-foreground text-xs mt-1 truncate" :title="`${show.last_edited_by}, ${formatEditedAt(show.last_edited_at)}`">
                    {{ show.last_edited_by }}, {{ formatEditedAt(show.last_edited_at) }}
                  </p>
                </div>
                <div class="shrink-0 pr-2 flex gap-1" @click.stop>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="text-muted-foreground hover:text-foreground"
                    @click="openAssign(show)"
                    :title="t('show.assign_template')"
                  >
                    <Pencil class="size-4" aria-hidden="true" />
                  </Button>
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
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ t('show.new') }}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div>
            <Label for="showName">{{ t('show.name') }}</Label>
            <Input size="lg" id="showName" v-model="form.name" type="text" required />
          </div>
          <div>
            <Label for="showDate">{{ t('show.date') }}</Label>
            <Input size="lg" id="showDate" v-model="form.datum" type="date" />
          </div>
          <div>
            <Label for="showTemplate">{{ t('show.template') }}</Label>
            <Select id="showTemplate" v-model="form.template">
              <SelectTrigger size="lg" class="w-full">
                <SelectValue :placeholder="t('show.template.none')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{{ t('show.template.none') }}</SelectItem>
                <SelectItem v-for="tpl in templates" :key="tpl.name" :value="tpl.name">
                  {{ templateDisplayName(tpl.name) }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" type="button" @click="drawerOpen = false">
            {{ t('action.cancel') }}
          </Button>
          <Button type="button" :disabled="creating" @click="handleCreate">
            <Loader2 v-if="creating" class="mr-2 size-4 animate-spin" />
            {{ creating ? t('show.creating') : t('show.create') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <!-- Bühnen-Template zuweisen: Dialog -->
    <Dialog :open="assignDialogOpen" @update:open="assignDialogOpen = $event">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ t('show.assign_template') }}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p v-if="assignShow" class="text-sm text-muted-foreground">{{ assignShow.name || assignShow.id }}</p>
          <Select v-model="assignTemplate">
            <SelectTrigger size="lg" class="w-full">
              <SelectValue :placeholder="t('show.template.none')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{{ t('show.template.none') }}</SelectItem>
              <SelectItem v-for="tpl in templates" :key="tpl.name" :value="tpl.name">
                {{ templateDisplayName(tpl.name) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" @click="assignDialogOpen = false">{{ t('action.cancel') }}</Button>
          <Button :disabled="assignSaving" @click="handleAssign">
            {{ assignSaving ? '…' : t('action.save') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  <!-- FAB -->
  <Button variant="accent" @click="openCreate" class="fixed bottom-6 right-6 h-11 px-5 shadow-lg border-0 flex items-center gap-2">
    + {{ t('show.new') }}
  </Button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Archive, Loader2, Pencil, Plus } from 'lucide-vue-next'
import { useLocale } from '../composables/useLocale.js'
import { fetchShows, createShow, archiveShow, updateMeta } from '../api/shows.js'
import { fetchTemplates, fetchTemplateChannels } from '../api/templates.js'
import { cached, invalidate } from '../api/cache.js'
import { saveChannels } from '../api/channels.js'
import { templateDisplayName } from '../utils/templateName.js'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'
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
const form = ref({ name: '', datum: new Date().toISOString().slice(0, 10), template: '__none__' })

const assignDialogOpen = ref(false)
const assignShow = ref(null)
const assignTemplate = ref('__none__')
const assignSaving = ref(false)

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
    const tplCreate = form.value.template === '__none__' ? '' : form.value.template
    const content = `---\nid: ${id}\nname: ${form.value.name || id}\ndatum: ${form.value.datum || new Date().toISOString().slice(0, 10)}\n${tplCreate ? `template: ${tplCreate}\n` : ''}---\n\n`
    await createShow({ id, name: form.value.name || id, datum: form.value.datum || new Date().toISOString().slice(0, 10), content, template: tplCreate || undefined })
    invalidate('shows')
    const newShow = { id, name: form.value.name || id, datum: form.value.datum || new Date().toISOString().slice(0, 10), template: tplCreate }
    shows.value.push(newShow)
    if (tplCreate) {
      try {
        const channels = await fetchTemplateChannels(tplCreate)
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

function openCreate() {
  form.value = { name: '', datum: new Date().toISOString().slice(0, 10), template: '__none__' }
  drawerOpen.value = true
}

function openAssign(show) {
  assignShow.value = show
  assignTemplate.value = show.template || '__none__'
  assignDialogOpen.value = true
}

async function handleAssign() {
  assignSaving.value = true
  try {
    const tplVal = assignTemplate.value === '__none__' ? null : assignTemplate.value
    await updateMeta(assignShow.value.id, { template: tplVal })
    invalidate('shows')
    const show = shows.value.find(s => s.id === assignShow.value.id)
    if (show) show.template = tplVal || ''
    assignDialogOpen.value = false
  } catch (e) {
    console.error('Failed to assign template:', e)
  } finally {
    assignSaving.value = false
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
