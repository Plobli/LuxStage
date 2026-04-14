<template>
  <!-- Sections (inline editor) -->
  <div ref="sortableSectionsEl" class="space-y-6 mb-6">
    <section
      v-for="sec in sortedSections"
      :key="sec.id"
      :data-section-id="sec.id"
      class="group/sec mb-8"
    >
      <!-- Section header -->
      <div class="flex items-center mb-4">
        <input
          :value="sec.title"
          :placeholder="labels.titlePlaceholder"
          @input="sec.title = $event.target.value"
          @change="persistSectionDefs"
          class="pr-3 text-lg font-semibold text-accent bg-gray-950 shrink-0 border-0 focus:outline-none min-w-0 placeholder:text-accent/40"
          :size="Math.max((sec.title || labels.titlePlaceholder).length, 4)"
        />
        <div class="flex-1 border-t border-accent/40"></div>
        <span class="section-drag-handle cursor-grab text-gray-400 hover:text-gray-200 transition-colors shrink-0 pl-3">
          <svg class="size-4" viewBox="0 0 20 20" fill="currentColor"><path d="M7 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM7 10a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM7 16a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM13 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM13 10a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM13 16a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>
        </span>
        <button class="text-gray-400 hover:text-red-400 shrink-0 transition-colors pl-2" @click="deleteSectionDef(sortedSections.indexOf(sec))">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <!-- Fields section -->
      <div v-if="sec.type === 'fields'">
        <div
          :data-fields-sortable="sec.id"
          class="divide-y divide-white/5 mb-2"
        >
          <div
            v-for="(field, fidx) in sec.fields"
            :key="field.key"
            class="flex items-center h-[40px] gap-2 group/field"
          >
            <span class="field-drag-handle cursor-grab text-gray-400 hover:text-gray-200 transition-colors shrink-0">
              <svg class="size-4" viewBox="0 0 20 20" fill="currentColor"><path d="M7 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM7 10a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM7 16a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM13 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM13 10a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM13 16a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>
            </span>
            <label class="w-28 text-sm text-gray-500 shrink-0">
              <input
                :value="field.label"
                :placeholder="labels.fieldLabel"
                @input="field.label = $event.target.value"
                @change="persistSectionDefs"
                class="w-full bg-transparent border-0 text-sm text-gray-400 focus:text-white focus:outline-none placeholder:text-gray-600"
              />
            </label>
            <input
              :value="parseFieldValue(sec.id, field.key)"
              @change="onFieldChange(sec.id, field.key, $event.target.value)"
              class="flex-1 bg-transparent border-0 border-b border-white/10 focus:border-accent focus:outline-none text-sm text-white h-full px-2 transition-colors"
            />
            <button class="text-gray-400 hover:text-red-400 shrink-0 transition-colors" @click="deleteFieldDef(sec, fidx)">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <button class="text-xs text-gray-500 hover:text-white" @click="addFieldDef(sec)">{{ labels.fieldAdd }}</button>
      </div>

      <!-- Markdown/Textfeld section -->
      <MarkdownEditor
        v-else
        :modelValue="sectionContents.get(sec.id) ?? ''"
        @update:modelValue="onSectionChange(sec.id, $event)"
      />
    </section>
  </div>

  <!-- Fallback: single setup editor (when no sections defined) -->
  <section v-if="sortedSections.length === 0" class="mb-8">
    <slot name="setup-heading" />
    <MarkdownEditor :modelValue="setupMarkdown" @update:modelValue="emit('update:setupMarkdown', $event)" />
  </section>

  <!-- Add section buttons -->
  <div class="flex items-center gap-2 mb-6 py-2 border-t border-white/10">
    <button class="cursor-pointer text-sm text-gray-500 hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors" @click="addMarkdownSection">{{ labels.addMarkdown }}</button>
    <button v-if="!hasFieldsType()" class="cursor-pointer text-sm text-gray-500 hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors" @click="addFieldsSection">{{ labels.addFields }}</button>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import Sortable from 'sortablejs'
import MarkdownEditor from '../MarkdownEditor.vue'
import { useConfirm } from '../../composables/useConfirm.js'
import { useLocale } from '../../composables/useLocale.js'
import { saveShowSectionDefs } from '../../api/sections.js'
import { uuid } from '../../utils/uuid.js'

const props = defineProps({
  showId: { type: String, required: true },
  sectionDefs: { type: Array, required: true },
  sectionContents: { type: Map, required: true },
  setupMarkdown: { type: String, default: '' },
  labels: {
    type: Object,
    default: () => ({
      titlePlaceholder: 'Abschnitt',
      fieldLabel: 'Feld',
      fieldAdd: '+ Feld hinzufügen',
      addMarkdown: '+ Textabschnitt',
      addFields: '+ Felder',
    }),
  },
})

const emit = defineEmits([
  'update:sectionDefs',
  'update:sectionContents',
  'update:setupMarkdown',
  'pushSnapshot',
  'sectionChange',  // triggers debounced save in parent
])

const { confirm } = useConfirm()
const { t } = useLocale()

const sortableSectionsEl = ref(null)

const sortedSections = computed(() =>
  [...props.sectionDefs].sort((a, b) => a.order - b.order)
)

// ── SortableJS for sections ────────────────────────────────────────────────
let sortableInstance = null

function initSectionsSortable() {
  sortableInstance?.destroy()
  sortableInstance = null
  if (!sortableSectionsEl.value) return
  sortableInstance = Sortable.create(sortableSectionsEl.value, {
    handle: '.section-drag-handle',
    animation: 150,
    onEnd() {
      const els = sortableSectionsEl.value.querySelectorAll('[data-section-id]')
      const newOrder = [...els].map(el => el.getAttribute('data-section-id'))
      const reordered = newOrder.map((id, i) => {
        const sec = props.sectionDefs.find(s => s.id === id)
        return { ...sec, order: i }
      })
      emit('update:sectionDefs', reordered)
      persistSectionDefs()
    }
  })
}

watch(() => props.sectionDefs.length, () => nextTick(initSectionsSortable), { immediate: true })
watch(sortableSectionsEl, (el) => { if (el) nextTick(initSectionsSortable) })

// ── SortableJS for fields within sections ──────────────────────────────────
watch(() => props.sectionDefs.map(s => s.fields?.length).join(','), async () => {
  await nextTick()
  document.querySelectorAll('[data-fields-sortable]').forEach(el => {
    Sortable.create(el, {
      handle: '.field-drag-handle',
      animation: 150,
      onEnd(evt) {
        const sectionId = el.getAttribute('data-fields-sortable')
        const newDefs = props.sectionDefs.map(s => {
          if (s.id !== sectionId) return s
          const fields = [...s.fields]
          const moved = fields.splice(evt.oldIndex, 1)[0]
          fields.splice(evt.newIndex, 0, moved)
          fields.forEach((f, i) => { f.sort_order = i })
          return { ...s, fields }
        })
        emit('update:sectionDefs', newDefs)
        persistSectionDefs()
      }
    })
  })
}, { immediate: true })

onBeforeUnmount(() => { sortableInstance?.destroy() })

// ── Section content changes ────────────────────────────────────────────────
function onSectionChange(id, value) {
  const newMap = new Map(props.sectionContents)
  newMap.set(id, value)
  emit('update:sectionContents', newMap)
  emit('sectionChange')
}

function parseFieldValue(sectionId, key) {
  const raw = props.sectionContents.get(sectionId) ?? '{}'
  try { return JSON.parse(raw)[key] ?? '' } catch { return '' }
}

function onFieldChange(sectionId, key, value) {
  const raw = props.sectionContents.get(sectionId) ?? '{}'
  let obj = {}
  try { obj = JSON.parse(raw) } catch {}
  if (value === '') { delete obj[key] } else { obj[key] = value }
  onSectionChange(sectionId, JSON.stringify(obj))
}

// ── Section def management ─────────────────────────────────────────────────
async function persistSectionDefs() {
  await saveShowSectionDefs(props.showId, props.sectionDefs)
}

async function addMarkdownSection() {
  emit('pushSnapshot')
  const id = uuid()
  const newDefs = [...props.sectionDefs, { id, title: '', type: 'markdown', order: props.sectionDefs.length, fields: [] }]
  emit('update:sectionDefs', newDefs)
  await saveShowSectionDefs(props.showId, newDefs)
}

async function addFieldsSection() {
  emit('pushSnapshot')
  const id = uuid()
  const newDefs = [...props.sectionDefs, { id, title: '', type: 'fields', order: props.sectionDefs.length, fields: [] }]
  emit('update:sectionDefs', newDefs)
  await saveShowSectionDefs(props.showId, newDefs)
}

async function deleteSectionDef(idx) {
  const ok = await confirm({ t, titleKey: 'action.delete', confirmKey: 'action.delete', cancelKey: 'action.cancel' })
  if (!ok) return
  emit('pushSnapshot')
  const newDefs = props.sectionDefs.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i }))
  emit('update:sectionDefs', newDefs)
  await saveShowSectionDefs(props.showId, newDefs)
}

function addFieldDef(section) {
  emit('pushSnapshot')
  const newDefs = props.sectionDefs.map(s => {
    if (s.id !== section.id) return s
    return { ...s, fields: [...(s.fields ?? []), { key: uuid().slice(0, 8), label: '' }] }
  })
  emit('update:sectionDefs', newDefs)
  persistSectionDefs()
}

async function deleteFieldDef(section, idx) {
  const ok = await confirm({ t, titleKey: 'action.delete', confirmKey: 'action.delete', cancelKey: 'action.cancel' })
  if (!ok) return
  emit('pushSnapshot')
  const newDefs = props.sectionDefs.map(s => {
    if (s.id !== section.id) return s
    const fields = s.fields.filter((_, i) => i !== idx)
    return { ...s, fields }
  })
  emit('update:sectionDefs', newDefs)
  persistSectionDefs()
}

function hasFieldsType() {
  return props.sectionDefs.some(s => s.type === 'fields')
}
</script>
