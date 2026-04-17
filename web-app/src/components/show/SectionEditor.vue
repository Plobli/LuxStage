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
        <!-- kv-table: echte Tabelle mit direkten rows -->
        <div v-if="sec.type === 'kv-table'">
          <!-- Tabellen-Header -->
          <div class="mb-1 grid grid-cols-[2rem_minmax(180px,0.9fr)_minmax(0,1.4fr)_2.5rem] items-center border-b border-border/50 pb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground/70">
            <div></div>
            <div class="px-3">{{ labels.fieldLabel }}</div>
            <div class="px-3">{{ labels.fieldValue }}</div>
            <div></div>
          </div>

          <!-- Zeilen -->
          <div :data-kv-sortable="sec.id">
            <div
              v-for="row in sortedRows(sec)"
              :key="row.id"
              :data-row-id="row.id"
              class="grid min-h-11 grid-cols-[2rem_minmax(180px,0.9fr)_minmax(0,1.4fr)_2.5rem] items-stretch border-b border-border/30 last:border-0"
            >
              <span class="kv-drag-handle inline-flex cursor-grab items-center justify-center text-muted-foreground/40 transition-colors hover:text-foreground active:cursor-grabbing">
                <GripVertical class="size-4" />
              </span>
              <Input
                :value="row.label"
                :placeholder="labels.fieldLabel"
                @input="row.label = $event.target.value"
                @change="persistKvRows(sec)"
                class="h-full rounded-none border-0 border-r border-border/30 bg-transparent px-3 py-0 text-sm font-medium text-foreground shadow-none placeholder:text-muted-foreground/35 focus-visible:ring-0"
              />
              <Input
                :value="row.value"
                @input="row.value = $event.target.value"
                @change="persistKvRows(sec)"
                class="h-full rounded-none border-0 bg-transparent px-3 py-0 text-sm text-foreground shadow-none placeholder:text-muted-foreground/30 focus-visible:ring-0"
              />
              <Button variant="ghost" size="icon" class="h-full w-full rounded-none text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400" @click="deleteKvRow(sec, row.id)">
                <X class="size-4" />
              </Button>
            </div>
          </div>

          <Button variant="outline" size="sm" class="mt-3 rounded-full border-border/50 bg-background/70 px-4 text-foreground hover:bg-muted/40" @click="addKvRow(sec)">{{ labels.fieldAdd }}</Button>
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
    <Button v-if="!hasKvTableType()" variant="outline" size="sm" class="rounded-full border-border/50 bg-background/70 px-4 text-foreground hover:bg-muted/40" @click="addKvTableSection">{{ labels.addFields }}</Button>
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
      fieldValue: 'Wert',
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
  'sectionChange',
])

const { confirm } = useConfirm()
const { t } = useLocale()

const sortableSectionsEl = ref(null)

// ── Migration: fields → kv-table ──────────────────────────────────────────
// Konvertiert 'fields'-Sections zu 'kv-table'.
// Repariert außerdem 'kv-table'-Sections die leere rows haben aber noch
// Werte in sectionContents (als JSON) besitzen – Übergangsfall nach fehlgeschlagener
// erster Migration.
function migrateAndRepair(defs, contentsMap) {
  let changed = false
  const newDefs = defs.map(sec => {
    // Fall 1: alter fields-Typ → kv-table
    if (sec.type === 'fields') {
      changed = true
      const rawJson = contentsMap.get(sec.id) ?? '{}'
      let valueObj = {}
      try { valueObj = JSON.parse(rawJson) } catch {}
      const rows = (sec.fields ?? [])
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((f, i) => ({
          id: f.id ?? uuid(),
          label: f.label ?? '',
          value: valueObj[f.key] ?? '',
          sort_order: i,
        }))
      return { id: sec.id, title: sec.title, type: 'kv-table', order: sec.order, rows }
    }

    // Fall 2: bereits kv-table, aber rows leer und in sectionContents noch
    // ein JSON-Objekt mit Werten → erster Migrations-Versuch schlug fehl
    if (sec.type === 'kv-table' && (sec.rows ?? []).length === 0) {
      const rawJson = contentsMap.get(sec.id) ?? ''
      if (!rawJson) return sec
      let valueObj = null
      try { valueObj = JSON.parse(rawJson) } catch {}
      // Nur reparieren wenn es ein nicht-leeres Objekt ist (kein Array, kein leeres {})
      if (!valueObj || typeof valueObj !== 'object' || Array.isArray(valueObj)) return sec
      const entries = Object.entries(valueObj)
      if (entries.length === 0) return sec
      changed = true
      const rows = entries.map(([key, value], i) => ({
        id: uuid(),
        label: key,   // key ist hier der Feldname (best-effort Fallback)
        value: String(value ?? ''),
        sort_order: i,
      }))
      return { ...sec, rows }
    }

    return sec
  })
  return { defs: newDefs, changed }
}

// Migration beim Laden, sobald beide Props befüllt sind.
watch(
  [() => props.sectionDefs, () => props.sectionContents],
  ([defs, contents]) => {
    const needsMigration = defs.some(s => s.type === 'fields')
    const needsRepair = defs.some(
      s => s.type === 'kv-table' && (s.rows ?? []).length === 0 && contents.get(s.id)
    )
    if (!needsMigration && !needsRepair) return

    // Warten bis sectionContents geladen – wenn es sections gibt die einen
    // content-Eintrag haben sollten, aber die Map noch leer ist.
    const contentSections = defs.filter(s => s.type === 'markdown' || s.type === 'fields')
    if (contentSections.length > 0 && contents.size === 0) return

    const { defs: migrated, changed } = migrateAndRepair(defs, contents)
    if (changed) {
      emit('update:sectionDefs', migrated)
      saveShowSectionDefs(props.showId, migrated)
    }
  },
  { immediate: true }
)

// ── Helpers ────────────────────────────────────────────────────────────────
const sortedSections = computed(() =>
  [...props.sectionDefs].sort((a, b) => a.order - b.order)
)

function sortedRows(sec) {
  return [...(sec.rows ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

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

// ── SortableJS for kv-table rows ───────────────────────────────────────────
const kvSortableInstances = new Map()

watch(
  () => props.sectionDefs.map(s => s.type === 'kv-table' ? (s.rows?.length ?? 0) : 0).join(','),
  async () => {
    await nextTick()
    // Destroy alte Instanzen für nicht mehr existierende Sections
    for (const [id, inst] of kvSortableInstances) {
      if (!props.sectionDefs.find(s => s.id === id)) {
        inst.destroy()
        kvSortableInstances.delete(id)
      }
    }
    // Neue/geänderte Sections initialisieren
    for (const sec of props.sectionDefs.filter(s => s.type === 'kv-table')) {
      const el = document.querySelector(`[data-kv-sortable="${sec.id}"]`)
      if (!el) continue
      kvSortableInstances.get(sec.id)?.destroy()
      const instance = Sortable.create(el, {
        handle: '.kv-drag-handle',
        animation: 150,
        onEnd(evt) {
          const sectionId = sec.id
          const newDefs = props.sectionDefs.map(s => {
            if (s.id !== sectionId) return s
            const rows = [...(s.rows ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            const moved = rows.splice(evt.oldIndex, 1)[0]
            rows.splice(evt.newIndex, 0, moved)
            rows.forEach((r, i) => { r.sort_order = i })
            return { ...s, rows }
          })
          emit('update:sectionDefs', newDefs)
          persistSectionDefs(newDefs)
        }
      })
      kvSortableInstances.set(sec.id, instance)
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  sortableInstance?.destroy()
  for (const inst of kvSortableInstances.values()) inst.destroy()
})

// ── Section content changes (markdown) ────────────────────────────────────
function onSectionChange(id, value) {
  const newMap = new Map(props.sectionContents)
  newMap.set(id, value)
  emit('update:sectionContents', newMap)
  emit('sectionChange')
}

// ── kv-table row persistence ───────────────────────────────────────────────
// Rows werden direkt in sectionDefs gehalten (sec.rows).
// Persistenz läuft über saveShowSectionDefs (section_defs + section_fields wird
// nicht mehr verwendet – der Server speichert rows über section_contents als JSON-Array).
function persistKvRows(sec) {
  // rows sind schon in-place mutiert (v-model-ähnlich über @input).
  // Wir emittieren sectionDefs damit Parent-State aktuell bleibt,
  // und triggern sectionChange für den debounced save.
  const newDefs = props.sectionDefs.map(s => s.id === sec.id ? { ...s, rows: sec.rows } : s)
  emit('update:sectionDefs', newDefs)
  persistSectionDefs(newDefs)
}

// ── Section def management ─────────────────────────────────────────────────
async function persistSectionDefs(sectionDefs = props.sectionDefs) {
  await saveShowSectionDefs(props.showId, sectionDefs)
}

async function addMarkdownSection() {
  emit('pushSnapshot')
  const id = uuid()
  const newDefs = [...props.sectionDefs, { id, title: '', type: 'markdown', order: props.sectionDefs.length }]
  emit('update:sectionDefs', newDefs)
  await saveShowSectionDefs(props.showId, newDefs)
}

async function addKvTableSection() {
  emit('pushSnapshot')
  const id = uuid()
  const newDefs = [...props.sectionDefs, { id, title: '', type: 'kv-table', order: props.sectionDefs.length, rows: [] }]
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

function addKvRow(sec) {
  emit('pushSnapshot')
  const newRow = { id: uuid(), label: '', value: '', sort_order: (sec.rows?.length ?? 0) }
  const newDefs = props.sectionDefs.map(s => {
    if (s.id !== sec.id) return s
    return { ...s, rows: [...(s.rows ?? []), newRow] }
  })
  emit('update:sectionDefs', newDefs)
  persistSectionDefs(newDefs)
}

async function deleteKvRow(sec, rowId) {
  const ok = await confirm({ t, titleKey: 'action.delete', confirmKey: 'action.delete', cancelKey: 'action.cancel' })
  if (!ok) return
  emit('pushSnapshot')
  const newDefs = props.sectionDefs.map(s => {
    if (s.id !== sec.id) return s
    const rows = (s.rows ?? [])
      .filter(r => r.id !== rowId)
      .map((r, i) => ({ ...r, sort_order: i }))
    return { ...s, rows }
  })
  emit('update:sectionDefs', newDefs)
  persistSectionDefs(newDefs)
}

function hasKvTableType() {
  return props.sectionDefs.some(s => s.type === 'kv-table')
}
</script>
