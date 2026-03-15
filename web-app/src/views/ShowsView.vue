<template>
  <div class="page">
    <div class="page-header">
      <h2>{{ t('nav.shows') }}</h2>
      <button class="btn-primary" @click="createDialog.showModal()">{{ t('show.new') }}</button>
    </div>

    <div v-if="loading" class="loading">…</div>

    <div v-else-if="shows.length === 0" class="empty">{{ t('show.list.empty') }}</div>

    <div v-else class="show-list">
      <div v-for="group in groupedShows" :key="group.template" class="show-group">
        <h3 class="show-group-title">{{ group.template || '—' }}</h3>
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
          <label>{{ t('show.name') }}</label>
          <input v-model="form.name" type="text" required />
        </div>
        <div class="field">
          <label>{{ t('show.date') }}</label>
          <input v-model="form.datum" type="date" />
        </div>
        <div class="field">
          <label>{{ t('show.template') }}</label>
          <select v-model="form.template">
            <option value="">{{ t('show.template.none') }}</option>
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

const form = ref({ name: '', datum: new Date().toISOString().slice(0, 10), template: '' })

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
    const content = buildInitialContent({ ...form.value, id })
    await createShow({ id, content, template: form.value.template || undefined })

    if (form.value.template) {
      const channels = await fetchTemplateChannels(form.value.template)
      if (channels.length) await saveChannels(id, channels)

      const secs = await fetchTemplateSections(form.value.template)
      if (secs.length) await saveShowSectionDefs(id, secs)
    }

    createDialog.value.close()
    router.push(`/shows/${id}`)
  } finally {
    creating.value = false
  }
}

async function archive(id) {
  await archiveShow(id)
  shows.value = shows.value.filter(s => s.id !== id)
}

function buildInitialContent({ id, name, datum, template }) {
  const tplLine = template ? `template: ${template}\n` : ''
  return `---\nid: ${id}\nname: ${name || id}\ndatum: ${datum || new Date().toISOString().slice(0, 10)}\n${tplLine}---\n\n`
}
</script>
