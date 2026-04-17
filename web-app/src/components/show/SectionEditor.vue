<template>
  <!-- Sections (inline editor) -->
  <div ref="sortableSectionsEl" class="mb-6 space-y-4">
    <section
      v-for="sec in sortedSections"
      :key="sec.id"
      :data-section-id="sec.id"
      class="group/sec relative overflow-hidden rounded-[24px] border border-border/60 bg-card/95 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-sm"
    >
      <div class="border-b border-border/50 bg-muted/10 px-5 py-4">
        <div class="flex items-center gap-3">
          <Input
            :value="sec.title"
            :placeholder="labels.titlePlaceholder"
            @input="sec.title = $event.target.value"
            @change="persistSectionDefs"
            class="h-10 min-w-[10rem] flex-1 border-0 bg-transparent px-0 text-base font-semibold text-foreground shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0"
          />
          <div class="flex items-center gap-1.5">
            <span class="section-drag-handle inline-flex size-8 cursor-grab items-center justify-center rounded-full border border-border/40 bg-background/60 text-muted-foreground transition-colors hover:border-border/70 hover:text-foreground active:cursor-grabbing shrink-0">
              <GripVertical class="size-4" />
            </span>
            <Button variant="ghost" size="icon" class="h-8 w-8 rounded-full text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400 shrink-0" @click="deleteSectionDef(sortedSections.indexOf(sec))">
              <X class="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <div class="px-5 py-5">
        <div v-if="sec.type === 'fields'" class="space-y-3">
          <div
            :data-fields-sortable="sec.id"
            class="space-y-2"
          >
            <div
              v-for="(field, fidx) in sec.fields"
              :key="field.key"
              class="group/field overflow-hidden rounded-2xl border border-border/50 bg-background/40"
            >
              <div class="grid min-h-11 grid-cols-[40px_minmax(180px,0.9fr)_minmax(0,1.4fr)_40px] items-stretch">
                <span class="field-drag-handle inline-flex cursor-grab items-center justify-center border-r border-border/40 text-muted-foreground/45 transition-colors hover:text-foreground active:cursor-grabbing">
                  <GripVertical class="size-4" />
                </span>
                <Input
                  :value="field.label"
                  :placeholder="labels.fieldLabel"
                  @input="field.label = $event.target.value"
                  @change="persistSectionDefs"
                  class="h-full rounded-none border-0 border-r border-border/40 bg-transparent px-3 py-0 text-sm font-medium text-foreground shadow-none placeholder:text-muted-foreground/35 focus-visible:ring-0"
                />
                <Input
                  :value="parseFieldValue(sec.id, field.key)"
                  @change="onFieldChange(sec.id, field.key, $event.target.value)"
                  class="h-full rounded-none border-0 bg-transparent px-3 py-0 text-sm text-foreground shadow-none placeholder:text-muted-foreground/30 focus-visible:ring-0"
                />
                <Button variant="ghost" size="icon" class="h-full w-full rounded-none border-l border-border/40 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400" @click="deleteFieldDef(sec, fidx)">
                  <X class="size-4" />
                </Button>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" class="mt-1 rounded-full border-border/50 bg-background/70 px-4 text-foreground hover:bg-muted/40" @click="addFieldDef(sec)">{{ labels.fieldAdd }}</Button>
        </div>

        <MarkdownEditor
          v-else
          :modelValue="sectionContents.get(sec.id) ?? ''"
          @update:modelValue="onSectionChange(sec.id, $event)"
        />
      </div>
    </section>
  </div>

  <!-- Fallback: single setup editor (when no sections defined) -->
  <section v-if="sortedSections.length === 0" class="mb-8 overflow-hidden rounded-[24px] border border-dashed border-border/60 bg-card/95">
    <div class="border-b border-border/50 bg-muted/10 px-5 py-4">
      <slot name="setup-heading" />
    </div>
    <div class="px-5 py-5">
      <MarkdownEditor :modelValue="setupMarkdown" @update:modelValue="emit('update:setupMarkdown', $event)" />
    </div>
  </section>

  <!-- Add section buttons -->
  <div class="mb-6 flex items-center gap-2 border-t border-border/50 py-4">
    <Button variant="outline" size="sm" class="rounded-full border-border/50 bg-background/70 px-4 text-foreground hover:bg-muted/40" @click="addMarkdownSection">{{ labels.addMarkdown }}</Button>
    <Button v-if="!hasFieldsType()" variant="outline" size="sm" class="rounded-full border-border/50 bg-background/70 px-4 text-foreground hover:bg-muted/40" @click="addFieldsSection">{{ labels.addFields }}</Button>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { GripVertical, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
      persistSectionDefs(reordered)
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
        persistSectionDefs(newDefs)
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
async function persistSectionDefs(sectionDefs = props.sectionDefs) {
  await saveShowSectionDefs(props.showId, sectionDefs)
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
  const targetId = sortedSections.value[idx]?.id
  if (!targetId) return
  const newDefs = props.sectionDefs
    .filter(s => s.id !== targetId)
    .map((s, i) => ({ ...s, order: i }))
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
  persistSectionDefs(newDefs)
}

async function deleteFieldDef(section, idx) {
  const ok = await confirm({ t, titleKey: 'action.delete', confirmKey: 'action.delete', cancelKey: 'action.cancel' })
  if (!ok) return
  emit('pushSnapshot')
  const newDefs = props.sectionDefs.map(s => {
    if (s.id !== section.id) return s
    const sortedFields = [...(s.fields ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const targetKey = sortedFields[idx]?.key
    if (!targetKey) return s
    const fields = (s.fields ?? [])
      .filter(field => field.key !== targetKey)
      .map((field, order) => ({ ...field, sort_order: order }))
    return { ...s, fields }
  })
  emit('update:sectionDefs', newDefs)
  persistSectionDefs(newDefs)
}

function hasFieldsType() {
  return props.sectionDefs.some(s => s.type === 'fields')
}
</script>
