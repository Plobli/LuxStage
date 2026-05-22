<template>
  <div class="px-4 py-10 sm:px-6 lg:px-8">
    <div class="sm:flex sm:items-center mb-8">
      <div class="sm:flex-auto">
        <h1 class="text-2xl font-semibold text-foreground">{{ t('nav.archive') }}</h1>
      </div>
    </div>

    <!-- Bestätigungsdialog Löschen -->
    <Dialog :open="!!deleteTarget" @update:open="(val) => { if(!val) deleteTarget = null }">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ t('show.delete.confirm.title') }}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p class="text-sm text-muted-foreground">
            {{ deleteTarget ? t('show.delete.confirm.text', { name: deleteTarget.name || deleteTarget.id }) : '' }}
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" @click="deleteTarget = null">
            {{ t('action.cancel') }}
          </Button>
          <Button variant="destructive" @click="deletePermanent">
            {{ t('show.delete') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <div v-if="loading" class="text-sm text-muted-foreground">…</div>

    <div v-else-if="shows.length === 0" class="flex flex-col items-center justify-center py-24 gap-2 text-center">
      <p class="text-muted-foreground text-sm">{{ t('show.archive.empty') }}</p>
      <p class="text-muted-foreground/60 text-xs">{{ t('show.archive.empty.hint') }}</p>
    </div>

    <ul v-else role="list" class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <li
        v-for="show in shows"
        :key="show.id"
        class="col-span-1"
      >
        <Card class="overflow-hidden px-4 py-3 flex flex-col gap-2">
          <div>
            <p class="font-semibold text-foreground text-base leading-tight">{{ show.name || show.id }}</p>
          </div>
          <div class="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span v-if="show.template" class="flex items-center gap-1 bg-muted rounded px-2 py-0.5">
              <Tag class="size-3" />{{ show.template }}
            </span>
            <span v-if="show.datum" class="flex items-center gap-1 bg-muted rounded px-2 py-0.5">
              <CalendarDays class="size-3" />{{ formatDatum(show.datum) }}
            </span>
          </div>
          <div class="flex items-center justify-between border-t border-border pt-2 mt-1">
            <span v-if="show.last_edited_by" class="text-xs text-muted-foreground truncate">Letzte Bearbeitung: {{ show.last_edited_by }}</span>
            <span v-else class="flex-1" />
            <div class="flex gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                class="text-muted-foreground"
                @click="restore(show.id)"
                :title="t('show.restore')"
              >
                <Undo class="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="text-muted-foreground"
                @click="confirmDelete(show)"
                :title="t('show.delete')"
              >
                <Trash2 class="size-4" />
              </Button>
            </div>
          </div>
        </Card>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { CalendarDays, Tag, Undo, Trash2 } from 'lucide-vue-next'
import { fetchArchivedShows, restoreShow, deleteShowPermanent } from '../api/shows.js'
import { useLocale } from '../composables/useLocale.js'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'

const { t } = useLocale()

const shows = ref([])
const loading = ref(true)
const deleteTarget = ref(null)

function formatDatum(d) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

onMounted(async () => {
  try {
    shows.value = await fetchArchivedShows()
  } finally {
    loading.value = false
  }
})

async function restore(id) {
  await restoreShow(id)
  shows.value = shows.value.filter(s => s.id !== id)
}

function confirmDelete(show) {
  deleteTarget.value = show
}

async function deletePermanent() {
  const id = deleteTarget.value.id
  deleteTarget.value = null
  await deleteShowPermanent(id)
  shows.value = shows.value.filter(s => s.id !== id)
}
</script>
