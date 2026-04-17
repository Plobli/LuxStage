<template>
  <div class="px-4 py-10 sm:px-6 lg:px-8">

    <!-- Detail-Ansicht (wenn eine Vorlage ausgewählt) -->
    <template v-if="editingName">
      <!-- Header -->
      <div class="flex items-center gap-x-4 mb-8">
        <Button variant="ghost" size="icon" class="text-muted-foreground hover:text-foreground" @click="editingName = null">
          <ArrowLeft class="size-5" />
        </Button>
        <h1 class="text-2xl font-semibold text-foreground">{{ templateDisplayName(editingName) || editingName }}</h1>
        <span v-if="detailSaving || sectionsSaving" class="text-xs text-muted-foreground">…</span>
      </div>

      <div v-if="detailLoading" class="text-sm text-muted-foreground">…</div>

      <template v-else>
        <Tabs v-model="activeTab" class="w-full">
          <TabsList class="w-full justify-start border-b border-border bg-transparent p-0 h-auto rounded-none mb-6">
            <TabsTrigger value="channels" class="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground rounded-none px-4 py-2 border-b-2 border-transparent">
              {{ t('show.channels') }}
            </TabsTrigger>
            <TabsTrigger value="sections" class="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground rounded-none px-4 py-2 border-b-2 border-transparent">
              {{ t('sections.btn') }}
            </TabsTrigger>
            <TabsTrigger value="floorplan" class="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground rounded-none px-4 py-2 border-b-2 border-transparent">
              Grundriss
            </TabsTrigger>
          </TabsList>

          <!-- Kanaltabelle -->
          <TabsContent value="channels" class="mt-0 outline-none">
            <div class="overflow-hidden border border-border rounded-lg bg-card">
              <Table>
            <TableHeader class="sticky top-0 z-10 bg-muted/50">
              <TableRow>
                <TableHead class="w-16">{{ t('field.channel') }}</TableHead>
                <TableHead class="w-24">{{ t('field.color') }}</TableHead>
                <TableHead class="w-[30ch]">{{ t('field.device') }}</TableHead>
                <TableHead class="w-[30ch]">{{ t('field.position') }}</TableHead>
                <TableHead>{{ t('field.notes') }}</TableHead>
                <TableHead class="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody v-for="group in groupedChannels" :key="group.position">
              <TableRow class="bg-muted/30 hover:bg-muted/30">
                <TableCell colspan="6" class="py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {{ group.position || t('channel.no_category') }}
                  <span class="ml-2 font-normal normal-case text-muted-foreground/70">{{ group.channels.length }}</span>
                </TableCell>
              </TableRow>
              <TableRow
                v-for="ch in group.channels"
                :key="ch.channel"
                class="group/row"
              >
                <TableCell class="align-top py-3">
                  <div class="flex flex-col items-center gap-1">
                    <Input
                      :model-value="ch.channel"
                      @update:model-value="ch.channel = $event; persist()"
                      class="h-10 text-xl font-bold font-mono px-1 text-center border-transparent hover:border-border focus:border-border bg-transparent shadow-none"
                    />
                    <Input
                      :model-value="ch.address"
                      @update:model-value="ch.address = $event; persist()"
                      class="h-6 text-xs text-muted-foreground px-1 text-center border-transparent hover:border-border focus:border-border bg-transparent shadow-none"
                    />
                  </div>
                </TableCell>
                <TableCell class="align-top py-3">
                  <ColorAutocomplete
                    :modelValue="ch.color"
                    @update:modelValue="ch.color = $event"
                    @change="persist()"
                    :placeholder="t('field.color')"
                  />
                </TableCell>
                <TableCell class="align-top py-3">
                  <Textarea :model-value="ch.device" @update:model-value="ch.device = $event; persist()" class="min-h-[60px] resize-none" />
                </TableCell>
                <TableCell class="align-top py-3">
                  <Input
                    :model-value="ch.position"
                    @update:model-value="ch.position = $event; persist()"
                    class="h-[60px]"
                  />
                </TableCell>
                <TableCell class="align-top py-3">
                  <Textarea :model-value="ch.notes" @update:model-value="ch.notes = $event; persist()" class="min-h-[60px] resize-none" />
                </TableCell>
                <TableCell class="align-top py-3 pr-4">
                  <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover/row:opacity-100 transition-opacity" @click="deleteChannel(ch)" :title="t('action.delete')">✕</Button>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colspan="6" class="py-2">
                  <Button variant="ghost" size="sm" class="text-muted-foreground hover:text-foreground" @click="startAdd(group.position)">+ {{ t('channel.add') }}</Button>
                </TableCell>
              </TableRow>
              <TableRow v-if="addingToPosition === group.position" class="bg-muted/30" @keydown.escape="addingToPosition = null" @keydown.enter.prevent="confirmAdd">
                <TableCell class="align-top py-3">
                  <div class="flex flex-col items-center gap-1">
                    <Input autofocus class="h-10 text-xl font-bold font-mono px-1 text-center" v-model="addForm.channel" :placeholder="t('show.channel.nr')" />
                    <Input class="h-6 text-xs text-muted-foreground px-1 text-center" v-model="addForm.address" />
                  </div>
                </TableCell>
                <TableCell class="align-top py-3">
                  <ColorAutocomplete
                    v-model="addForm.color"
                    @change="() => {}"
                    :placeholder="t('field.color')"
                  />
                </TableCell>
                <TableCell class="align-top py-3"><Textarea class="min-h-[60px] resize-none" v-model="addForm.device" /></TableCell>
                <TableCell class="align-top py-3"><Input class="h-[60px]" v-model="addForm.position" /></TableCell>
                <TableCell class="align-top py-3"><Textarea class="min-h-[60px] resize-none" v-model="addForm.notes" /></TableCell>
                <TableCell class="align-top py-3 pr-4"><Button variant="ghost" size="icon" class="h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-500/10" @click="confirmAdd">✓</Button></TableCell>
              </TableRow>
            </TableBody>
            <TableBody v-if="groupedChannels.length === 0">
              <TableRow v-if="addingToPosition === ''" class="bg-muted/30" @keydown.escape="addingToPosition = null" @keydown.enter.prevent="confirmAdd">
                <TableCell class="align-top py-3">
                  <div class="flex flex-col items-center gap-1">
                    <Input autofocus class="h-10 text-xl font-bold font-mono px-1 text-center" v-model="addForm.channel" :placeholder="t('show.channel.nr')" />
                    <Input class="h-6 text-xs text-muted-foreground px-1 text-center" v-model="addForm.address" />
                  </div>
                </TableCell>
                <TableCell class="align-top py-3">
                  <ColorAutocomplete
                    v-model="addForm.color"
                    @change="() => {}"
                    :placeholder="t('field.color')"
                  />
                </TableCell>
                <TableCell class="align-top py-3"><Textarea class="min-h-[60px] resize-none" v-model="addForm.device" /></TableCell>
                <TableCell class="align-top py-3"><Input class="h-[60px]" v-model="addForm.position" /></TableCell>
                <TableCell class="align-top py-3"><Textarea class="min-h-[60px] resize-none" v-model="addForm.notes" /></TableCell>
                <TableCell class="align-top py-3 pr-4"><Button variant="ghost" size="icon" class="h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-500/10" @click="confirmAdd">✓</Button></TableCell>
              </TableRow>
              <TableRow v-else>
                <TableCell colspan="6" class="py-8 text-center">
                  <span class="text-sm text-muted-foreground">{{ t('channel.list.empty') }}</span>
                  <Button variant="outline" size="sm" class="ml-3" @click="startAdd('')">+ {{ t('channel.add') }}</Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
            </div>
          </TabsContent>

          <!-- Sections-Editor -->
          <TabsContent value="sections" class="mt-0 outline-none space-y-4 max-w-2xl">
          <div v-for="(sec, idx) in templateSections" :key="sec.id" class="border border-border rounded-lg p-4 space-y-3 bg-card">
            <div class="flex items-center gap-2">
              <div class="flex flex-col gap-0.5">
                <Button variant="ghost" size="icon" class="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-30" :disabled="idx === 0" @click="moveSection(idx, -1)">▲</Button>
                <Button variant="ghost" size="icon" class="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-30" :disabled="idx === templateSections.length - 1" @click="moveSection(idx, 1)">▼</Button>
              </div>
              <Input
                :model-value="sec.title"
                :placeholder="t('sections.title.placeholder')"
                @update:model-value="sec.title = $event"
                @change="persistSections"
                class="flex-1"
              />
              <Select :model-value="sec.type" @update:model-value="(value) => onTypeChange(sec, value)">
                <SelectTrigger class="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="markdown">{{ t('sections.type.markdown') }}</SelectItem>
                    <SelectItem value="kv-table" :disabled="hasKvTableType() && sec.type !== 'kv-table'">{{ t('sections.type.fields') }}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" class="shrink-0 text-muted-foreground hover:text-destructive" @click="deleteSection(idx)">✕</Button>
            </div>
            <div v-if="sec.type === 'kv-table' || sec.type === 'fields'" class="space-y-2 pl-6">
              <div v-for="(row, fidx) in (sec.rows ?? sec.fields ?? [])" :key="row.key" class="flex items-center gap-2">
                <Input
                  :model-value="row.label"
                  :placeholder="t('sections.field.label')"
                  @update:model-value="row.label = $event"
                  @change="persistSections"
                  class="flex-1"
                />
                <Button variant="ghost" size="icon" class="shrink-0 text-muted-foreground hover:text-destructive" @click="deleteField(sec, fidx)">✕</Button>
              </div>
              <Button variant="outline" size="sm" @click="addField(sec)">+ {{ t('sections.field.add') }}</Button>
            </div>
          </div>
          <Button variant="outline" size="sm" @click="addSection">+ {{ t('sections.add') }}</Button>
          </TabsContent>

          <!-- Grundriss-Bild Upload -->
          <TabsContent value="floorplan" class="mt-0 outline-none max-w-xl space-y-4">
          <div class="text-sm text-muted-foreground">
            Lade ein Bild des Bühnengrundrisses hoch. Dieses Bild dient als Hintergrund für den Grundriss-Editor in allen Shows mit diesem Template.
          </div>

          <!-- Aktuelles Bild -->
          <div v-if="floorplanImageUrl" class="relative">
            <img :src="floorplanImageUrl" class="w-full rounded border border-border object-contain max-h-64 bg-muted/10" />
            <Button
              variant="destructive" size="sm" class="absolute top-2 right-2"
              @click="removeFloorplanImage"
            >Entfernen</Button>
          </div>

          <div v-else class="border-2 border-dashed border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
            Noch kein Grundriss-Bild
          </div>

          <!-- Upload -->
          <Button variant="secondary" as-child :disabled="floorplanUploading">
            <label class="cursor-pointer inline-flex items-center gap-2">
              <Upload class="size-4" />
              {{ floorplanUploading ? 'Wird hochgeladen…' : 'Bild hochladen' }}
              <input type="file" accept="image/*" class="sr-only" @change="onFloorplanImageUpload" :disabled="floorplanUploading" />
            </label>
          </Button>

          <Alert v-if="floorplanError" variant="destructive">
            <AlertDescription>{{ floorplanError }}</AlertDescription>
          </Alert>
            </TabsContent>
            </Tabs>
            </template> 
    </template>

    <!-- Vorlagen-Liste -->
    <template v-else>
      <div class="sm:flex sm:items-center mb-8">
        <div class="sm:flex-auto">
          <h1 class="text-base font-semibold text-foreground">{{ t('nav.templates') }}</h1>
        </div>
        <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <Button @click="openUpload">
            {{ t('template.upload') }}
          </Button>
        </div>
      </div>

      <div v-if="loading" class="text-sm text-muted-foreground">…</div>
      <div v-else-if="templates.length === 0" class="text-sm text-muted-foreground">{{ t('template.list.empty') }}</div>

      <ul v-else role="list" class="divide-y divide-border">
        <li v-for="name in templates" :key="name" class="flex items-center justify-between gap-x-6 py-5">
          <Button variant="link" class="min-w-0 text-left px-0 font-semibold" @click="openDetail(name)">
            {{ templateDisplayName(name) || name }}
          </Button>
          <div class="flex flex-none items-center gap-x-4">
            <Button variant="outline" size="sm" @click="openDetail(name)">
              {{ t('action.edit') }}
            </Button>
            <Button variant="ghost" size="sm" class="text-red-400 hover:text-red-300 hover:bg-red-500/10" @click="handleDelete(name)">
              {{ t('action.delete') }}
            </Button>
          </div>
        </li>
      </ul>
    </template>

    <!-- Upload-Dialog -->
    <Dialog :open="uploadOpen" @update:open="val => { if (!val) closeUpload() }">
      <DialogContent class="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{{ t('template.upload') }}</DialogTitle>
        </DialogHeader>

        <div v-if="step === 'select'" class="border-2 border-dashed border-border rounded-lg p-8 text-center mt-4" @dragover.prevent @drop.prevent="onDrop">
          <input ref="fileInput" type="file" accept=".csv,.txt" hidden @change="onFileChange" />
          <p class="text-sm text-muted-foreground mb-4">{{ t('template.upload.hint') }}</p>
          <Button @click="fileInput?.click()">{{ t('template.csv.choose') }}</Button>
        </div>

        <div v-else-if="step === 'preview'" class="pt-4 space-y-4">
          <div>
            <Label for="importName" class="text-xs">{{ t('template.name') }}</Label>
            <Input id="importName" v-model="importName" type="text" required class="mt-1" />
          </div>
          <div class="text-sm text-muted-foreground">
            <span>{{ t('csv.preview.channels', { count: previewChannels.length }) }}</span>
          </div>
          <div class="overflow-x-auto max-h-96 border border-border rounded-md">
            <Table class="min-w-full text-sm">
              <TableHeader class="sticky top-0 bg-card shadow-sm">
                <TableRow>
                  <TableHead class="w-16">{{ t('field.channel') }}</TableHead>
                  <TableHead class="w-24">{{ t('field.address') }}</TableHead>
                  <TableHead class="w-[30ch]">{{ t('field.device') }}</TableHead>
                  <TableHead class="w-[30ch]">{{ t('field.position') }}</TableHead>
                  <TableHead class="w-24">{{ t('field.color') }}</TableHead>
                  <TableHead>{{ t('field.notes') }}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="ch in previewChannels.slice(0, 20)" :key="ch.channel">
                  <TableCell>{{ ch.channel }}</TableCell>
                  <TableCell>{{ ch.address }}</TableCell>
                  <TableCell>{{ ch.device }}</TableCell>
                  <TableCell>{{ ch.position }}</TableCell>
                  <TableCell>{{ ch.color }}</TableCell>
                  <TableCell>{{ ch.notes }}</TableCell>
                </TableRow>
                <TableRow v-if="previewChannels.length > 20">
                  <TableCell colspan="6" class="text-center text-muted-foreground">{{ t('template.more_channels', { count: previewChannels.length - 20 }) }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <Alert v-if="importError" variant="destructive" class="mt-2">
            <AlertDescription>{{ importError }}</AlertDescription>
          </Alert>
          <DialogFooter class="flex justify-end gap-3 mt-4 sm:justify-end">
            <Button variant="outline" @click="step = 'select'">{{ t('action.back') }}</Button>
            <Button :disabled="importing || !importName.trim()" @click="handleImport">
              {{ importing ? '…' : t('template.upload.confirm') }}
            </Button>
          </DialogFooter>
        </div>

        <div v-else-if="step === 'done'" class="py-8 text-center">
          <p class="text-foreground mb-4">✓ {{ t('template.upload.success') }}</p>
          <Button @click="closeUpload">{{ t('action.close') }}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ArrowLeft, Upload } from 'lucide-vue-next'
import { useLocale } from '../composables/useLocale.js'
import { useConfirm } from '../composables/useConfirm.js'
import { fetchTemplates, fetchTemplateChannels, saveTemplate, uploadTemplate, deleteTemplate } from '../api/templates.js'
import { fetchTemplateSections, saveTemplateSections } from '../api/sections.js'
import { templateDisplayName } from '../utils/templateName.js'
import ColorAutocomplete from '../components/ColorAutocomplete.vue'
import { uuid } from '../utils/uuid.js'
import { fetchTemplateFloorplan, uploadTemplateFloorplanImage, deleteTemplateFloorplanImage } from '../api/floorplan.js'
import { api } from '../api/client.js'

import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from '@/components/ui/select'

const { t } = useLocale()
const { confirm } = useConfirm()

const templates = ref([])
const loading = ref(true)

// Upload
const uploadOpen = ref(false)
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
const floorplanUploading = ref(false)
const floorplanError = ref('')

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
  uploadOpen.value = true
}

function closeUpload() {
  uploadOpen.value = false
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
}, { immediate: true })

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
  if (!file || floorplanUploading.value) return
  floorplanUploading.value = true
  floorplanError.value = ''
  try {
    const result = await uploadTemplateFloorplanImage(editingName.value, file)
    floorplanImageUrl.value = result.image_url ? api.url(result.image_url) : null
    e.target.value = ''
  } catch (err) {
    floorplanError.value = err?.message || 'Upload fehlgeschlagen'
  } finally {
    floorplanUploading.value = false
  }
}

async function removeFloorplanImage() {
  floorplanError.value = ''
  try {
    await deleteTemplateFloorplanImage(editingName.value)
    floorplanImageUrl.value = null
  } catch (err) {
    floorplanError.value = err?.message || 'Löschen fehlgeschlagen'
  }
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
  templateSections.value.push({ id: uuid(), title: '', type: 'markdown', order: templateSections.value.length, rows: [] })
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
  if (!section.rows) section.rows = []
  section.rows.push({ key: uuid().slice(0, 8), label: '', value: '' })
  persistSections()
}

function deleteField(section, idx) {
  const arr = section.rows ?? section.fields
  arr?.splice(idx, 1)
  persistSections()
}

function hasKvTableType() {
  return templateSections.value.some(s => s.type === 'kv-table' || s.type === 'fields')
}

function onTypeChange(section, newType) {
  if (newType === 'kv-table' && hasKvTableType() && section.type !== 'kv-table' && section.type !== 'fields') return
  section.type = newType
  if (newType === 'kv-table' && !section.rows) section.rows = []
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
