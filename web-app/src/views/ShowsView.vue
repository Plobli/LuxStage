<template>
  <div class="page">
    <div class="page-header">
      <h2>{{ $t('nav.shows') }}</h2>
      <div class="header-actions">
        <button class="btn-ghost" @click="showArchived = !showArchived">
          {{ showArchived ? $t('action.back') : $t('show.archived') }}
        </button>
        <button class="btn-primary" @click="openCreateDialog">{{ $t('show.new') }}</button>
      </div>
    </div>

    <div v-if="loading" class="loading">…</div>

    <div v-else-if="shows.length === 0" class="empty">
      {{ showArchived ? $t('show.list.archived_empty') : $t('show.list.empty') }}
    </div>

    <div v-else class="show-list">
      <div
        v-for="show in shows"
        :key="show.id"
        class="show-card"
        @click="router.push(`/shows/${show.id}`)"
      >
        <div class="show-card-main">
          <span class="show-name">{{ show.name }}</span>
          <span class="show-date">{{ formatDate(show.date) }}</span>
        </div>
        <div class="show-card-meta">
          <span v-if="show.expand?.template" class="tag">{{ show.expand.template.venue_name }}</span>
        </div>
        <div class="show-card-actions" @click.stop>
          <button v-if="!showArchived" class="btn-ghost-sm" @click="archive(show.id)">
            {{ $t('show.archive') }}
          </button>
          <button v-else class="btn-ghost-sm" @click="unarchive(show.id)">
            {{ $t('show.unarchive') }}
          </button>
          <button class="btn-danger-sm" @click="confirmDelete(show)">{{ $t('show.delete') }}</button>
        </div>
      </div>
    </div>

    <!-- Create show dialog -->
    <dialog ref="createDialog" class="modal">
      <div class="modal-header">
        <h3>{{ $t('show.new') }}</h3>
        <button class="btn-ghost" @click="createDialog.close()">✕</button>
      </div>
      <form @submit.prevent="handleCreate">
        <div class="field">
          <label>{{ $t('show.name') }}</label>
          <input v-model="form.name" type="text" required />
        </div>
        <div class="field">
          <label>{{ $t('show.date') }}</label>
          <input v-model="form.date" type="date" />
        </div>
        <div class="field">
          <label>{{ $t('show.template') }}</label>
          <select v-model="form.template">
            <option value="">{{ $t('show.template.none') }}</option>
            <option v-for="t in templates" :key="t.id" :value="t.id">
              {{ t.venue_name }} — {{ t.name }}
            </option>
          </select>
        </div>

        <!-- Custom fields from selected template -->
        <template v-if="selectedTemplateFields.length">
          <hr />
          <div v-for="field in selectedTemplateFields" :key="field.field_name" class="field">
            <label>
              {{ field.field_name }}
              <span v-if="field.unit_hint" class="hint">{{ field.unit_hint }}</span>
            </label>
            <input v-model="form.custom_field_values[field.field_name]" type="text" />
          </div>
        </template>

        <div class="modal-footer">
          <button type="button" class="btn-ghost" @click="createDialog.close()">
            {{ $t('action.cancel') }}
          </button>
          <button type="submit" class="btn-primary" :disabled="creating">
            {{ creating ? '…' : $t('show.create') }}
          </button>
        </div>
      </form>
    </dialog>

    <!-- Delete confirm dialog -->
    <dialog ref="deleteDialog" class="modal">
      <div class="modal-header">
        <h3>{{ $t('show.delete') }}</h3>
        <button class="btn-ghost" @click="deleteDialog.close()">✕</button>
      </div>
      <p>{{ pendingDelete?.name }}</p>
      <div class="modal-footer">
        <button class="btn-ghost" @click="deleteDialog.close()">{{ $t('action.cancel') }}</button>
        <button class="btn-danger" @click="handleDelete">{{ $t('action.delete') }}</button>
      </div>
    </dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  fetchShows, fetchArchivedShows, createShow, archiveShow, unarchiveShow, deleteShow,
} from '../api/shows.js'
import { fetchTemplates, fetchTemplateCustomFields } from '../api/templates.js'
import { bulkCreateChannels } from '../api/channels.js'

const router = useRouter()
const shows = ref([])
const templates = ref([])
const loading = ref(true)
const showArchived = ref(false)
const creating = ref(false)

const createDialog = ref(null)
const deleteDialog = ref(null)
const pendingDelete = ref(null)

const form = ref({ name: '', date: '', template: '', custom_field_values: {} })
const templateCustomFields = ref([])

const selectedTemplateFields = computed(() => {
  return form.value.template ? templateCustomFields.value : []
})

watch(() => form.value.template, async (id) => {
  form.value.custom_field_values = {}
  if (id) {
    templateCustomFields.value = await fetchTemplateCustomFields(id)
  } else {
    templateCustomFields.value = []
  }
})

watch(showArchived, loadShows)

onMounted(async () => {
  await Promise.all([loadShows(), loadTemplates()])
})

async function loadShows() {
  loading.value = true
  shows.value = showArchived.value ? await fetchArchivedShows() : await fetchShows()
  loading.value = false
}

async function loadTemplates() {
  templates.value = await fetchTemplates()
}

function openCreateDialog() {
  form.value = { name: '', date: '', template: '', custom_field_values: {} }
  createDialog.value.showModal()
}

async function handleCreate() {
  creating.value = true
  try {
    const show = await createShow({
      name: form.value.name,
      date: form.value.date || null,
      template: form.value.template || null,
      custom_field_values: form.value.custom_field_values,
      archived: false,
    })

    // Copy template channels into show channels
    if (form.value.template) {
      const { fetchTemplateChannels } = await import('../api/templates.js')
      const tplChannels = await fetchTemplateChannels(form.value.template)
      if (tplChannels.length) {
        await bulkCreateChannels(show.id, tplChannels.map(({ template, id, ...ch }) => ch))
      }
    }

    createDialog.value.close()
    router.push(`/shows/${show.id}`)
  } finally {
    creating.value = false
  }
}

async function archive(id) {
  await archiveShow(id)
  await loadShows()
}

async function unarchive(id) {
  await unarchiveShow(id)
  await loadShows()
}

function confirmDelete(show) {
  pendingDelete.value = show
  deleteDialog.value.showModal()
}

async function handleDelete() {
  await deleteShow(pendingDelete.value.id)
  deleteDialog.value.close()
  pendingDelete.value = null
  await loadShows()
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString()
}
</script>
