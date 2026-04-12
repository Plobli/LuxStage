<template>
  <div class="px-4 py-10 sm:px-6 lg:px-8">

    <!-- Detail-Ansicht (wenn eine Vorlage ausgewählt) -->
    <template v-if="editingName">
      <!-- Header -->
      <div class="flex items-center gap-x-4 mb-8">
        <button type="button" class="text-gray-400 hover:text-white" @click="editingName = null">
          <svg class="size-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clip-rule="evenodd" /></svg>
        </button>
        <h1 class="text-base font-semibold text-white">{{ templateDisplayName(editingName) || editingName }}</h1>
        <span v-if="detailSaving || sectionsSaving" class="text-xs text-gray-500">…</span>

        <!-- Tab-Switcher -->
        <div class="ml-auto flex gap-1 border-b border-white/10 -mb-10 pb-0">
          <button
            :class="['px-4 py-2 text-sm font-medium border-b-2 -mb-px', activeTab === 'channels' ? 'border-accent text-white' : 'border-transparent text-gray-400 hover:text-white']"
            @click="activeTab = 'channels'"
          >{{ t('show.channels') }}</button>
          <button
            :class="['px-4 py-2 text-sm font-medium border-b-2 -mb-px', activeTab === 'sections' ? 'border-accent text-white' : 'border-transparent text-gray-400 hover:text-white']"
            @click="activeTab = 'sections'"
          >{{ t('sections.btn') }}</button>
          <button
            :class="['px-4 py-2 text-sm font-medium border-b-2 -mb-px', activeTab === 'floorplan' ? 'border-accent text-white' : 'border-transparent text-gray-400 hover:text-white']"
            @click="activeTab = 'floorplan'"
          >Grundriss</button>
        </div>
      </div>

      <div v-if="detailLoading" class="text-sm text-gray-400">…</div>

      <template v-else>
        <!-- Kanaltabelle -->
        <div v-show="activeTab === 'channels'">
          <table class="min-w-full">
            <colgroup>
              <col class="w-16" />
              <col class="w-20" />
              <col class="w-[30ch]" />
              <col class="w-[30ch]" />
              <col />
              <col class="w-6" />
            </colgroup>
            <thead class="sticky top-0 z-10 bg-gray-950">
              <tr class="border-b border-white/10">
                <th scope="col" class="py-3 pr-3 pl-0 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{{ t('field.channel') }}</th>
                <th scope="col" class="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{{ t('field.color') }}</th>
                <th scope="col" class="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{{ t('field.device') }}</th>
                <th scope="col" class="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{{ t('field.position') }}</th>
                <th scope="col" class="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{{ t('field.notes') }}</th>
                <th scope="col" class="w-6"></th>
              </tr>
            </thead>
            <tbody v-for="group in groupedChannels" :key="group.position">
              <tr class="border-t border-white/5">
                <th colspan="6" scope="colgroup" class="py-2 pr-3 pl-0 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  {{ group.position || t('channel.no_category') }}
                  <span class="ml-2 font-normal normal-case text-gray-600">{{ group.channels.length }}</span>
                </th>
              </tr>
              <tr
                v-for="ch in group.channels"
                :key="ch.channel"
                class="border-t border-white/5 group/row hover:bg-white/[0.03] transition-colors align-middle"
              >
                <td class="py-2 pr-3 pl-0 align-middle">
                  <div class="flex flex-col items-center gap-1">
                    <input
                      :value="ch.channel"
                      @change="ch.channel = $event.target.value; persist()"
                      class="bg-transparent focus:bg-white/5 focus:outline-none text-2xl font-bold font-mono text-white px-0 border-0 leading-none w-[3ch] text-center"
                    />
                    <input
                      :value="ch.address"
                      @change="ch.address = $event.target.value; persist()"
                      class="bg-transparent focus:bg-white/5 focus:outline-none text-xs text-gray-500 px-0 border-0 w-[5ch] text-center"
                    />
                  </div>
                </td>
                <td class="px-3 py-2 align-middle">
                  <ColorAutocomplete
                    :modelValue="ch.color"
                    @update:modelValue="ch.color = $event"
                    @change="persist()"
                    :placeholder="t('field.color')"
                  />
                </td>
                <td class="px-3 py-0 align-middle">
                  <textarea :value="ch.device" @change="ch.device = $event.target.value; persist()" class="bg-white/[0.04] focus:bg-white/[0.07] focus:outline-none text-sm text-gray-300 w-full px-2 border-0 resize-none leading-snug [field-sizing:content] min-h-14 py-4 align-middle rounded" />
                </td>
                <td class="px-3 py-0 align-middle">
                  <input
                    :value="ch.position"
                    @change="ch.position = $event.target.value; persist()"
                    class="bg-white/[0.04] focus:bg-white/[0.07] focus:outline-none text-sm text-gray-300 w-full px-2 border-0 rounded h-14"
                  />
                </td>
                <td class="px-3 py-0 align-middle">
                  <textarea :value="ch.notes" @change="ch.notes = $event.target.value; persist()" class="bg-white/[0.04] focus:bg-white/[0.07] focus:outline-none text-sm text-gray-300 w-full px-2 border-0 resize-none leading-snug [field-sizing:content] min-h-14 py-4 align-middle rounded" />
                </td>
                <td class="py-2 pl-2 pr-0 align-middle">
                  <button class="text-gray-600 hover:text-red-400 text-xs opacity-0 group-hover/row:opacity-100 transition-opacity" @click="deleteChannel(ch)" :title="t('action.delete')">✕</button>
                </td>
              </tr>
              <tr class="border-t border-white/5">
                <td colspan="6" class="py-2 pl-0">
                  <button type="button" class="text-sm text-gray-600 hover:text-gray-300" @click="startAdd(group.position)">+ {{ t('channel.add') }}</button>
                </td>
              </tr>
              <tr v-if="addingToPosition === group.position" class="border-t border-white/5 bg-white/5" @keydown.escape="addingToPosition = null" @keydown.enter.prevent="confirmAdd">
                <td class="py-2 pr-3 pl-0 align-middle">
                  <div class="flex flex-col items-center gap-1">
                    <input autofocus class="bg-transparent focus:outline-none text-2xl font-bold font-mono text-white px-0 border-0 leading-none w-[3ch] text-center" v-model="addForm.channel" :placeholder="t('show.channel.nr')" />
                    <input class="bg-transparent focus:outline-none text-xs text-gray-500 px-0 border-0 w-[5ch] text-center" v-model="addForm.address" />
                  </div>
                </td>
                <td class="px-3 py-2 align-middle">
                  <ColorAutocomplete
                    v-model="addForm.color"
                    @change="() => {}"
                    :placeholder="t('field.color')"
                  />
                </td>
                <td class="px-3 py-0 align-middle"><textarea class="bg-white/[0.04] focus:outline-none text-sm text-gray-300 w-full px-2 border-0 resize-none leading-snug [field-sizing:content] min-h-14 py-4 align-middle rounded" v-model="addForm.device" /></td>
                <td class="px-3 py-0 align-middle"><input class="bg-white/[0.04] focus:outline-none text-sm text-gray-300 w-full px-2 border-0 rounded h-14" v-model="addForm.position" /></td>
                <td class="px-3 py-0 align-middle"><textarea class="bg-white/[0.04] focus:outline-none text-sm text-gray-300 w-full px-2 border-0 resize-none leading-snug [field-sizing:content] min-h-14 py-4 align-middle rounded" v-model="addForm.notes" /></td>
                <td class="py-2 pl-2 pr-0 align-middle"><button class="text-green-400 hover:text-green-300 text-sm" @click="confirmAdd">✓</button></td>
              </tr>
            </tbody>
            <tbody v-if="groupedChannels.length === 0">
              <tr v-if="addingToPosition === ''" class="border-t border-white/5 bg-white/5" @keydown.escape="addingToPosition = null" @keydown.enter.prevent="confirmAdd">
                <td class="py-2 pr-3 pl-0 align-middle">
                  <div class="flex flex-col items-center gap-1">
                    <input autofocus class="bg-transparent focus:outline-none text-2xl font-bold font-mono text-white px-0 border-0 leading-none w-[3ch] text-center" v-model="addForm.channel" :placeholder="t('show.channel.nr')" />
                    <input class="bg-transparent focus:outline-none text-xs text-gray-500 px-0 border-0 w-[5ch] text-center" v-model="addForm.address" />
                  </div>
                </td>
                <td class="px-3 py-2 align-middle">
                  <ColorAutocomplete
                    v-model="addForm.color"
                    @change="() => {}"
                    :placeholder="t('field.color')"
                  />
                </td>
                <td class="px-3 py-0 align-middle"><textarea class="bg-white/[0.04] focus:outline-none text-sm text-gray-300 w-full px-2 border-0 resize-none leading-snug [field-sizing:content] min-h-14 py-4 align-middle rounded" v-model="addForm.device" /></td>
                <td class="px-3 py-0 align-middle"><input class="bg-white/[0.04] focus:outline-none text-sm text-gray-300 w-full px-2 border-0 rounded h-14" v-model="addForm.position" /></td>
                <td class="px-3 py-0 align-middle"><textarea class="bg-white/[0.04] focus:outline-none text-sm text-gray-300 w-full px-2 border-0 resize-none leading-snug [field-sizing:content] min-h-14 py-4 align-middle rounded" v-model="addForm.notes" /></td>
                <td class="py-2 pl-2 pr-0 align-middle"><button class="text-green-400 hover:text-green-300 text-sm" @click="confirmAdd">✓</button></td>
              </tr>
              <tr v-else class="border-t border-white/5">
                <td colspan="6" class="py-4 pl-0">
                  <span class="text-sm text-gray-500">{{ t('channel.list.empty') }}</span>
                  <button type="button" class="ml-3 text-sm text-gray-400 hover:text-white" @click="startAdd('')">+ {{ t('channel.add') }}</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Sections-Editor -->
        <div v-show="activeTab === 'sections'" class="space-y-4 max-w-2xl">
          <div v-for="(sec, idx) in templateSections" :key="sec.id" class="border border-white/10 rounded-lg p-4 space-y-3">
            <div class="flex items-center gap-2">
              <div class="flex flex-col gap-0.5">
                <button class="text-gray-500 hover:text-white text-[10px] leading-none px-0.5 disabled:opacity-30" :disabled="idx === 0" @click="moveSection(idx, -1)">▲</button>
                <button class="text-gray-500 hover:text-white text-[10px] leading-none px-0.5 disabled:opacity-30" :disabled="idx === templateSections.length - 1" @click="moveSection(idx, 1)">▼</button>
              </div>
              <input
                :value="sec.title"
                :placeholder="t('sections.title.placeholder')"
                @input="sec.title = $event.target.value"
                @change="persistSections"
                class="flex-1 bg-white/5 rounded-md px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent"
              />
              <select
                :value="sec.type"
                @change="onTypeChange(sec, $event.target.value)"
                class="bg-white/5 rounded-md px-2 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10"
              >
                <option value="markdown" class="bg-gray-900">{{ t('sections.type.markdown') }}</option>
                <option value="fields" :disabled="hasFieldsType() && sec.type !== 'fields'" class="bg-gray-900">{{ t('sections.type.fields') }}</option>
              </select>
              <button class="text-gray-500 hover:text-red-400 text-sm shrink-0" @click="deleteSection(idx)">✕</button>
            </div>
            <div v-if="sec.type === 'fields'" class="space-y-2 pl-6">
              <div v-for="(field, fidx) in sec.fields" :key="field.key" class="flex items-center gap-2">
                <input
                  :value="field.label"
                  :placeholder="t('sections.field.label')"
                  @input="field.label = $event.target.value"
                  @change="persistSections"
                  class="flex-1 bg-white/5 rounded-md px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-accent"
                />
                <button class="text-gray-500 hover:text-red-400 text-sm shrink-0" @click="deleteField(sec, fidx)">✕</button>
              </div>
              <button class="text-sm text-gray-400 hover:text-white" @click="addField(sec)">+ {{ t('sections.field.add') }}</button>
            </div>
          </div>
          <button class="text-sm text-gray-400 hover:text-white" @click="addSection">+ {{ t('sections.add') }}</button>
        </div>

        <!-- Grundriss-Bild Upload -->
        <div v-show="activeTab === 'floorplan'" class="max-w-xl space-y-4">
          <div class="text-sm text-gray-400">
            Lade ein Bild des Bühnengrundrisses hoch. Dieses Bild dient als Hintergrund für den Grundriss-Editor in allen Shows mit diesem Template.
          </div>

          <!-- Aktuelles Bild -->
          <div v-if="floorplanImageUrl" class="relative">
            <img :src="floorplanImageUrl" class="w-full rounded border border-white/10 object-contain max-h-64 bg-gray-900" />
            <button
              class="absolute top-2 right-2 bg-gray-950/80 text-red-400 hover:text-red-300 rounded px-2 py-1 text-xs"
              @click="removeFloorplanImage"
            >Entfernen</button>
          </div>

          <div v-else class="border-2 border-dashed border-white/10 rounded-lg p-8 text-center text-gray-500 text-sm">
            Noch kein Grundriss-Bild
          </div>

          <!-- Upload -->
          <label class="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded text-sm text-gray-300 transition-colors">
            <svg class="size-4" viewBox="0 0 20 20" fill="currentColor"><path d="M9.25 13.25a.75.75 0 0 0 1.5 0V4.636l2.955 3.129a.75.75 0 0 0 1.09-1.03l-4.25-4.5a.75.75 0 0 0-1.09 0l-4.25 4.5a.75.75 0 1 0 1.09 1.03L9.25 4.636v8.614Z"/><path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z"/></svg>
            Bild hochladen
            <input type="file" accept="image/*" class="sr-only" @change="onFloorplanImageUpload" />
          </label>
        </div>
      </template>
    </template>

    <!-- Vorlagen-Liste -->
    <template v-else>
      <div class="sm:flex sm:items-center mb-8">
        <div class="sm:flex-auto">
          <h1 class="text-base font-semibold text-white">{{ t('nav.templates') }}</h1>
        </div>
        <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            type="button"
            class="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-hover"
            @click="openUpload"
          >
            {{ t('template.upload') }}
          </button>
        </div>
      </div>

      <div v-if="loading" class="text-sm text-gray-400">…</div>
      <div v-else-if="templates.length === 0" class="text-sm text-gray-400">{{ t('template.list.empty') }}</div>

      <ul v-else role="list" class="divide-y divide-white/10">
        <li v-for="name in templates" :key="name" class="flex items-center justify-between gap-x-6 py-5">
          <button type="button" class="min-w-0 text-left hover:text-accent transition-colors" @click="openDetail(name)">
            <p class="text-sm/6 font-semibold text-white">{{ templateDisplayName(name) || name }}</p>
          </button>
          <div class="flex flex-none items-center gap-x-4">
            <button type="button" class="rounded-md px-2.5 py-1.5 text-sm font-semibold text-white ring-1 ring-white/10 hover:ring-white/20" @click="openDetail(name)">
              {{ t('action.edit') }}
            </button>
            <button type="button" class="rounded-md px-2.5 py-1.5 text-sm font-semibold text-red-400 ring-1 ring-white/10 hover:ring-red-400/50" @click="handleDelete(name)">
              {{ t('action.delete') }}
            </button>
          </div>
        </li>
      </ul>
    </template>

    <!-- Upload-Dialog (bleibt als Modal, da Datei-Upload) -->
    <dialog ref="uploadDialog" class="m-auto w-full max-w-3xl rounded-xl bg-gray-950 ring-1 ring-white/10 shadow-2xl p-0 backdrop:bg-black/50">
      <div class="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <h3 class="text-base font-semibold text-white">{{ t('template.upload') }}</h3>
        <button class="rounded-md px-3 py-2 text-sm font-semibold text-gray-400 ring-1 ring-white/10 hover:ring-white/20" @click="closeUpload">✕</button>
      </div>

      <div v-if="step === 'select'" class="border-2 border-dashed border-white/20 rounded-lg p-8 text-center m-6" @dragover.prevent @drop.prevent="onDrop">
        <input ref="fileInput" type="file" accept=".csv,.txt" hidden @change="onFileChange" />
        <p class="text-sm text-gray-400 mb-4">{{ t('template.upload.hint') }}</p>
        <button class="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover" @click="fileInput?.click()">{{ t('template.csv.choose') }}</button>
      </div>

      <div v-else-if="step === 'preview'" class="px-6 pt-4">
        <div class="text-sm text-gray-400 mb-4">
          <div class="mb-2">
            <label class="block text-xs text-gray-400 mb-1">{{ t('template.name') }}</label>
            <input v-model="importName" type="text" required class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent" />
          </div>
          <span>{{ t('csv.preview.channels', { count: previewChannels.length }) }}</span>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-400 border-b border-white/10">{{ t('field.channel') }}</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-400 border-b border-white/10">{{ t('field.address') }}</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-400 border-b border-white/10">{{ t('field.device') }}</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-400 border-b border-white/10">{{ t('field.position') }}</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-400 border-b border-white/10">{{ t('field.color') }}</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-400 border-b border-white/10">{{ t('field.notes') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ch in previewChannels.slice(0, 20)" :key="ch.channel">
                <td class="px-3 py-2 text-white border-b border-white/10">{{ ch.channel }}</td>
                <td class="px-3 py-2 text-white border-b border-white/10">{{ ch.address }}</td>
                <td class="px-3 py-2 text-white border-b border-white/10">{{ ch.device }}</td>
                <td class="px-3 py-2 text-white border-b border-white/10">{{ ch.position }}</td>
                <td class="px-3 py-2 text-white border-b border-white/10">{{ ch.color }}</td>
                <td class="px-3 py-2 text-white border-b border-white/10">{{ ch.notes }}</td>
              </tr>
              <tr v-if="previewChannels.length > 20">
                <td colspan="6" class="px-3 py-2 text-gray-400">{{ t('template.more_channels', { count: previewChannels.length - 20 }) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="flex justify-end gap-3 py-4 border-t border-white/10 mt-4">
          <span v-if="importError" class="text-sm text-red-400 flex-1">{{ importError }}</span>
          <button class="rounded-md px-3 py-2 text-sm font-semibold text-gray-400 ring-1 ring-white/10 hover:ring-white/20" @click="step = 'select'">{{ t('action.back') }}</button>
          <button class="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50" :disabled="importing || !importName.trim()" @click="handleImport">
            {{ importing ? '…' : t('template.upload.confirm') }}
          </button>
        </div>
      </div>

      <div v-else-if="step === 'done'" class="px-6 py-8 text-center">
        <p class="text-white mb-4">✓ {{ t('template.upload.success') }}</p>
        <button class="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover" @click="closeUpload">{{ t('action.close') }}</button>
      </div>
    </dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useLocale } from '../composables/useLocale.js'
import { useConfirm } from '../composables/useConfirm.js'
import { fetchTemplates, fetchTemplateChannels, saveTemplate, uploadTemplate, deleteTemplate } from '../api/templates.js'
import { fetchTemplateSections, saveTemplateSections } from '../api/sections.js'
import { templateDisplayName } from '../utils/templateName.js'
import ColorAutocomplete from '../components/ColorAutocomplete.vue'
import { uuid } from '../utils/uuid.js'
import { fetchTemplateFloorplan, uploadTemplateFloorplanImage, deleteTemplateFloorplanImage } from '../api/floorplan.js'
import { api } from '../api/client.js'

const { t } = useLocale()
const { confirm } = useConfirm()

const templates = ref([])
const loading = ref(true)

// Upload
const uploadDialog = ref(null)
const fileInput = ref(null)
const step = ref('select')
const csvText = ref('')
const importName = ref('')
const previewChannels = ref([])
const importing = ref(false)
const importError = ref('')

// Detail (inline)
const editingName = ref(null)
const detailChannels = ref([])
const detailLoading = ref(false)
const detailSaving = ref(false)
const activeTab = ref('channels')
const templateSections = ref([])
const sectionsSaving = ref(false)
const addingToPosition = ref(null)
const addForm = ref({})
const floorplanImageUrl = ref(null)

const groupedChannels = computed(() => {
  const sorted = [...detailChannels.value].sort((a, b) => Number(a.channel) - Number(b.channel))
  const map = new Map()
  for (const ch of sorted) {
    const pos = ch.position || ''
    if (!map.has(pos)) map.set(pos, [])
    map.get(pos).push(ch)
  }
  return [...map.entries()].map(([position, channels]) => ({ position, channels }))
})

onMounted(async () => {
  templates.value = await fetchTemplates()
  loading.value = false
})

// ── Upload ──────────────────────────────────────────────────────────────────

function openUpload() {
  step.value = 'select'
  csvText.value = ''
  importName.value = ''
  previewChannels.value = []
  importError.value = ''
  uploadDialog.value.showModal()
}

function closeUpload() {
  uploadDialog.value.close()
  step.value = 'select'
}

function onFileChange(e) {
  const file = e.target.files[0]
  if (file) processFile(file)
}

function onDrop(e) {
  const file = e.dataTransfer.files[0]
  if (file) processFile(file)
}

function processFile(file) {
  importName.value = file.name.replace(/\.csv$/i, '')
  const reader = new FileReader()
  reader.onload = (e) => {
    csvText.value = e.target.result
    const lines = csvText.value.trim().split('\n').filter(Boolean)
    const headerIdx = lines.findIndex(l => l.startsWith('channel'))
    if (headerIdx !== -1) {
      const headers = lines[headerIdx].split(';').map(h => h.trim())
      previewChannels.value = lines.slice(headerIdx + 1).map(line => {
        const vals = line.split(';')
        return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').trim()]))
      })
    }
    step.value = 'preview'
  }
  reader.readAsText(file, 'utf-8')
}

async function handleImport() {
  importing.value = true
  importError.value = ''
  try {
    const name = importName.value.trim().replace(/\.csv$/i, '')
    await uploadTemplate({ name, text: csvText.value })
    templates.value = await fetchTemplates()
    step.value = 'done'
  } catch (e) {
    importError.value = e?.message || t('template.upload.error')
  } finally {
    importing.value = false
  }
}

// ── Detail ──────────────────────────────────────────────────────────────────

async function openDetail(name) {
  editingName.value = name
  detailLoading.value = true
  activeTab.value = 'channels'
  addingToPosition.value = null
  const [channels, sections] = await Promise.all([
    fetchTemplateChannels(name),
    fetchTemplateSections(name),
  ])
  detailChannels.value = channels
  templateSections.value = Array.isArray(sections) ? sections : (sections?.sections ?? [])
  detailLoading.value = false
}

watch(editingName, () => {
  loadFloorplan()
})

async function persist() {
  detailSaving.value = true
  await saveTemplate(editingName.value, detailChannels.value)
  detailSaving.value = false
}

async function loadFloorplan() {
  if (!editingName.value) return
  const data = await fetchTemplateFloorplan(editingName.value).catch(() => null)
  floorplanImageUrl.value = data?.image_url ? api.url(data.image_url) : null
}

async function onFloorplanImageUpload(e) {
  const file = e.target.files[0]
  if (!file) return
  const result = await uploadTemplateFloorplanImage(editingName.value, file)
  floorplanImageUrl.value = result.image_url ? api.url(result.image_url) : null
}

async function removeFloorplanImage() {
  await deleteTemplateFloorplanImage(editingName.value)
  floorplanImageUrl.value = null
}

async function persistSections() {
  sectionsSaving.value = true
  await saveTemplateSections(editingName.value, templateSections.value)
  sectionsSaving.value = false
}

async function deleteChannel(ch) {
  detailChannels.value = detailChannels.value.filter(c => c.channel !== ch.channel)
  await persist()
}

function startAdd(position) {
  addingToPosition.value = position
  addForm.value = { channel: '', address: '', device: '', position, color: '', notes: '' }
}

async function confirmAdd() {
  if (!addForm.value.channel.trim()) return
  detailChannels.value.push({ ...addForm.value })
  addingToPosition.value = null
  await persist()
}

// ── Sections ────────────────────────────────────────────────────────────────

function addSection() {
  templateSections.value.push({ id: uuid(), title: '', type: 'markdown', order: templateSections.value.length, fields: [] })
  persistSections()
}

function deleteSection(idx) {
  templateSections.value.splice(idx, 1)
  templateSections.value.forEach((s, i) => s.order = i)
  persistSections()
}

function moveSection(idx, dir) {
  const arr = templateSections.value
  const swap = idx + dir
  if (swap < 0 || swap >= arr.length) return
  ;[arr[idx], arr[swap]] = [arr[swap], arr[idx]]
  arr.forEach((s, i) => s.order = i)
  persistSections()
}

function addField(section) {
  section.fields.push({ key: uuid().slice(0, 8), label: '' })
  persistSections()
}

function deleteField(section, idx) {
  section.fields.splice(idx, 1)
  persistSections()
}

function hasFieldsType() {
  return templateSections.value.some(s => s.type === 'fields')
}

function onTypeChange(section, newType) {
  if (newType === 'fields' && hasFieldsType() && section.type !== 'fields') return
  section.type = newType
  if (newType === 'fields' && !section.fields) section.fields = []
  persistSections()
}

// ── Löschen ─────────────────────────────────────────────────────────────────

async function handleDelete(name) {
  const ok = await confirm({ t, titleKey: 'template.delete.confirm', messageParams: { name }, confirmKey: 'action.delete', cancelKey: 'action.cancel' })
  if (!ok) return
  await deleteTemplate(name)
  templates.value = templates.value.filter(n => n !== name)
}
</script>
