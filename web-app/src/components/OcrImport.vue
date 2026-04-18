<template>
  <!-- Trigger-Button — Klassen kommen vom Elternelement via $attrs -->
  <label v-bind="$attrs" class="cursor-pointer">
    {{ t('ocr.trigger') }}
    <input ref="fileInput" type="file" accept="image/*,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple class="sr-only" @click.stop @change="onFileSelected" />
  </label>

  <!-- Datenschutz-Hinweis + Vorschau-Dialog -->
  <Dialog :open="state !== 'idle'" @update:open="val => { if (!val) cancel() }">
    <DialogContent class="max-w-lg p-0 overflow-hidden" @interact-outside.prevent @escape-key-down="cancel">

      <!-- Datenschutz-Warnung -->
      <div v-if="state === 'confirm'" class="p-6 space-y-4">
        <DialogHeader>
          <div class="flex items-start gap-3">
            <div class="mt-0.5 shrink-0 rounded-full bg-yellow-400/10 p-2">
              <AlertTriangle class="size-5 text-yellow-400" />
            </div>
            <div>
              <DialogTitle class="text-sm font-semibold">{{ t('ocr.confirm.title') }}</DialogTitle>
              <p class="mt-1 text-sm text-muted-foreground">{{ t('ocr.confirm.body') }}</p>
            </div>
          </div>
        </DialogHeader>
        <!-- Vorschauen -->
        <div class="flex gap-2 overflow-x-auto">
          <template v-for="(file, i) in selectedFiles" :key="i">
            <!-- Dokument (PDF/Docx) -->
            <div v-if="isDocument(file)" class="relative shrink-0 h-24 w-24 rounded-lg bg-muted/40 flex flex-col items-center justify-center gap-1 ring-1 ring-border px-2">
              <FileText class="size-8 text-muted-foreground" />
              <span class="text-[10px] text-muted-foreground text-center break-all leading-tight">{{ file.name }}</span>
            </div>
            <!-- Bild -->
            <div v-else class="relative shrink-0">
              <img :src="previewUrls[i]" class="h-24 w-24 rounded-lg object-cover bg-black" />
              <span class="absolute bottom-1 right-1 text-[10px] bg-black/60 text-foreground rounded px-1">{{ i + 1 }}</span>
            </div>
          </template>
        </div>
        <p class="text-xs text-muted-foreground">{{ t('ocr.confirm.pages', { n: selectedFiles.length }) }}</p>
        <DialogFooter class="pt-2">
          <Button variant="ghost" @click.stop="cancel">{{ t('action.cancel') }}</Button>
          <Button @click.stop="upload">{{ t('ocr.confirm.send') }}</Button>
        </DialogFooter>
      </div>

      <!-- Lade-Indikator -->
      <div v-else-if="state === 'loading'" class="p-8 flex flex-col items-center gap-4">
        <Spinner size="lg" />
        <p class="text-sm text-muted-foreground">{{ t('ocr.loading') }}</p>
      </div>

      <!-- Ergebnis-Vorschau -->
      <div v-else-if="state === 'result'" class="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="text-sm font-semibold">{{ t('ocr.result.title') }}</DialogTitle>
        </DialogHeader>
        <pre class="text-xs text-foreground bg-muted/40 rounded-lg p-4 whitespace-pre-wrap break-words">{{ resultPreview }}</pre>
        <p class="text-xs text-muted-foreground">{{ t('ocr.result.hint') }}</p>
        <DialogFooter class="pt-2">
          <Button variant="ghost" @click="cancel">{{ t('action.cancel') }}</Button>
          <Button @click="apply">{{ t('ocr.result.apply') }}</Button>
        </DialogFooter>
      </div>

      <!-- Fehler -->
      <div v-else-if="state === 'error'" class="p-6 space-y-4">
        <Alert variant="destructive">
          <AlertDescription>{{ errorMsg }}</AlertDescription>
        </Alert>
        <div v-if="rawOutput" class="space-y-1">
          <p class="text-xs text-muted-foreground">Claude-Rohausgabe:</p>
          <pre class="text-xs text-foreground bg-muted/30 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap break-all">{{ rawOutput }}</pre>
        </div>
        <DialogFooter>
          <Button variant="ghost" @click="cancel">{{ t('action.close') }}</Button>
        </DialogFooter>
      </div>

    </DialogContent>
  </Dialog>
</template>

<script>
export default { inheritAttrs: false }
</script>

<script setup>
import { ref, computed } from 'vue'
import { AlertTriangle, FileText } from 'lucide-vue-next'
import { useLocale } from '../composables/useLocale.js'
import { ocrShowplan } from '../api/ocr.js'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Spinner from '@/components/Spinner.vue'

const emit = defineEmits(['import', 'dialog-open', 'dialog-close'])
const { t } = useLocale()

const fileInput = ref(null)
const state = ref('idle') // idle | confirm | loading | result | error
const previewUrls = ref([])
const selectedFiles = ref([])
const result = ref(null)
const errorMsg = ref('')
const rawOutput = ref('')

const DOC_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
function isDocument(file) {
  return DOC_TYPES.includes(file.type) || /\.(pdf|docx)$/i.test(file.name)
}

const resultPreview = computed(() => {
  if (!result.value) return ''
  return JSON.stringify(result.value, null, 2)
})

function onFileSelected(e) {
  const files = Array.from(e.target.files || [])
  if (!files.length) return
  selectedFiles.value = files
  previewUrls.value = files.map(f => isDocument(f) ? null : URL.createObjectURL(f))
  state.value = 'confirm'
  e.target.value = ''
  emit('dialog-open')
}

async function upload() {
  state.value = 'loading'
  try {
    result.value = await ocrShowplan(selectedFiles.value)
    state.value = 'result'
  } catch (err) {
    errorMsg.value = err.message
    rawOutput.value = err.rawOutput || ''
    state.value = 'error'
  }
}

function apply() {
  emit('import', result.value)
  cancel()
}

function cancel() {
  previewUrls.value.forEach(url => url && URL.revokeObjectURL(url))
  state.value = 'idle'
  previewUrls.value = []
  selectedFiles.value = []
  result.value = null
  errorMsg.value = ''
  rawOutput.value = ''
  emit('dialog-close')
}
</script>
