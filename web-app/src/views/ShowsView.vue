<template>
  <div class="page">
    <div class="page-header">
      <h2>{{ t('nav.shows') }}</h2>
      <button class="btn-primary" @click="createDialog.showModal()">{{ t('show.new') }}</button>
    </div>

    <div v-if="loading" class="loading">…</div>

    <div v-else-if="shows.length === 0" class="empty">{{ t('show.list.empty') }}</div>

    <div v-else class="show-list">
      <div v-for="group in groupedShows" :key="group.venue" class="show-group">
        <h3 class="show-group-title">{{ group.venue || '—' }}</h3>
        <div
          v-for="show in group.shows"
          :key="show.id"
          class="show-card"
          @click="router.push(`/shows/${show.id}`)"
        >
          <div class="show-card-main">
            <span class="show-name">{{ show.name || show.id }}</span>
            <span class="show-date">{{ show.datum }}</span>
          </div>
          <div class="show-card-actions" @click.stop>
            <button class="btn-ghost-sm" @click="archive(show.id)">{{ t('show.archive') }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Neue Show erstellen -->
    <dialog ref="createDialog" class="modal">
      <div class="modal-header">
        <h3>{{ t('show.new') }}</h3>
        <button class="btn-ghost" @click="createDialog.close()">✕</button>
      </div>
      <form @submit.prevent="handleCreate">
        <div class="field">
          <label>ID (Dateiname, keine Leerzeichen)</label>
          <input v-model="form.id" type="text" required pattern="[a-zA-Z0-9_-]+" placeholder="norden-2026" />
        </div>
        <div class="field">
          <label>{{ t('show.name') }}</label>
          <input v-model="form.name" type="text" required />
        </div>
        <div class="field">
          <label>Bühne</label>
          <input v-model="form.venue" type="text" />
        </div>
        <div class="field">
          <label>Datum</label>
          <input v-model="form.datum" type="date" />
        </div>
        <div class="field">
          <label>Template (optional)</label>
          <select v-model="form.template">
            <option value="">Kein Template</option>
            <option v-for="tpl in templates" :key="tpl" :value="tpl">{{ tpl }}</option>
          </select>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-ghost" @click="createDialog.close()">{{ t('action.cancel') }}</button>
          <button type="submit" class="btn-primary" :disabled="creating">
            {{ creating ? '…' : t('show.create') }}
          </button>
        </div>
      </form>
    </dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLocale } from '../composables/useLocale.js'
import { fetchShows, createShow, archiveShow } from '../api/shows.js'
import { fetchTemplates, fetchTemplateChannels } from '../api/templates.js'
import { saveChannels } from '../api/channels.js'
import { fetchTemplateSections, saveShowSectionDefs } from '../api/sections.js'

const router = useRouter()
const { t } = useLocale()

const shows = ref([])
const templates = ref([])
const loading = ref(true)
const creating = ref(false)
const createDialog = ref(null)

const form = ref({ id: '', name: '', venue: '', datum: '', template: '' })

const groupedShows = computed(() => {
  const map = new Map()
  for (const show of shows.value) {
    const venue = show.venue || ''
    if (!map.has(venue)) map.set(venue, [])
    map.get(venue).push(show)
  }
  return [...map.entries()].map(([venue, s]) => ({ venue, shows: s }))
})

onMounted(async () => {
  const [s, tpls] = await Promise.all([fetchShows(), fetchTemplates()])
  shows.value = s
  templates.value = tpls
  loading.value = false
})

async function handleCreate() {
  creating.value = true
  try {
    const content = buildInitialContent(form.value)
    await createShow({ id: form.value.id, content, template: form.value.template || undefined })

    // Template-Kanäle kopieren falls gewählt
    if (form.value.template) {
      const channels = await fetchTemplateChannels(form.value.template)
      if (channels.length) await saveChannels(form.value.id, channels)

      const secs = await fetchTemplateSections(form.value.template)
      if (secs.length) await saveShowSectionDefs(form.value.id, secs)
    }

    createDialog.value.close()
    router.push(`/shows/${form.value.id}`)
  } finally {
    creating.value = false
  }
}

async function archive(id) {
  await archiveShow(id)
  shows.value = shows.value.filter(s => s.id !== id)
}

function buildInitialContent({ id, name, venue, datum, template }) {
  const tplLine = template ? `template: ${template}\n` : ''
  return `---\nname: ${name || id}\nvenue: ${venue || ''}\ndatum: ${datum || new Date().toISOString().slice(0, 10)}\n${tplLine}---\n\n`
}
</script>
