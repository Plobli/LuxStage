<template>
  <div class="px-4 py-10 sm:px-6 lg:px-8">
    <div class="border-b border-border pb-5 mb-6">
      <h2 class="text-2xl font-semibold text-foreground">{{ t('nav.archive') }}</h2>
    </div>

    <!-- Bestätigungsdialog Löschen -->
    <Dialog :open="!!deleteTarget" @update:open="(val) => { if(!val) deleteTarget = null }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ t('show.delete.confirm.title') }}</DialogTitle>
        </DialogHeader>
        <p class="text-sm text-muted-foreground py-4">
          {{ deleteTarget ? t('show.delete.confirm.text', { name: deleteTarget.name || deleteTarget.id }) : '' }}
        </p>
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

    <div v-else-if="shows.length === 0" class="text-sm text-muted-foreground">
      {{ t('show.archive.empty') }}
    </div>

    <ul v-else role="list" class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <li
        v-for="show in shows"
        :key="show.id"
        class="col-span-1"
      >
        <Card class="flex h-full overflow-hidden">
          <div class="flex w-16 shrink-0 items-center justify-center bg-secondary text-sm font-medium text-secondary-foreground border-r border-border">
            {{ initials(show.name || show.id) }}
          </div>
          <div class="flex flex-1 items-center justify-between truncate bg-card">
            <div class="flex-1 truncate px-4 py-3 text-sm">
              <span class="font-medium text-foreground">{{ show.name || show.id }}</span>
              <p class="text-muted-foreground">{{ show.datum }}</p>
            </div>
            <div class="shrink-0 pr-4 flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                class="text-muted-foreground hover:text-foreground"
                @click="restore(show.id)"
                :title="t('show.restore')"
              >
                <Undo class="size-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="text-muted-foreground hover:text-destructive"
                @click="confirmDelete(show)"
                :title="t('show.delete')"
              >
                <Trash2 class="size-4" aria-hidden="true" />
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
import { Undo, Trash2 } from 'lucide-vue-next'
import { fetchArchivedShows, restoreShow, deleteShowPermanent } from '../api/shows.js'
import { useLocale } from '../composables/useLocale.js'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

const { t } = useLocale()

const shows = ref([])
const loading = ref(true)
const deleteTarget = ref(null)

function initials(name) {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
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
