<template>
  <!-- Trigger-Button — Klassen kommen vom Elternelement via $attrs -->
  <label v-bind="$attrs" class="cursor-pointer">
    {{ t('ocr.trigger') }}
    <input ref="fileInput" type="file" accept="image/*,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple class="sr-only" @click.stop @change="onFileSelected" />
  </label>

  <!-- Datenschutz-Hinweis + Vorschau-Dialog -->
  <Teleport to="body">
    <div v-if="state !== 'idle'" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70" @click.stop>
      <div class="w-full max-w-lg bg-gray-900 rounded-xl shadow-2xl ring-1 ring-white/10 overflow-hidden">

        <!-- Datenschutz-Warnung -->
        <div v-if="state === 'confirm'" class="p-6 space-y-4">
          <div class="flex items-start gap-3">
            <div class="mt-0.5 shrink-0 rounded-full bg-yellow-400/10 p-2">
              <svg class="size-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-semibold text-white">{{ t('ocr.confirm.title') }}</h3>
              <p class="mt-1 text-sm text-gray-400">{{ t('ocr.confirm.body') }}</p>
            </div>
          </div>
          <!-- Vorschauen -->
          <div class="flex gap-2 overflow-x-auto">
            <template v-for="(file, i) in selectedFiles" :key="i">
              <!-- Dokument (PDF/Docx) -->
              <div v-if="isDocument(file)" class="relative shrink-0 h-24 w-24 rounded-lg bg-white/5 flex flex-col items-center justify-center gap-1 ring-1 ring-white/10 px-2">
                <svg class="size-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                <span class="text-[10px] text-gray-400 text-center break-all leading-tight">{{ file.name }}</span>
              </div>
              <!-- Bild -->
              <div v-else class="relative shrink-0">
                <img :src="previewUrls[i]" class="h-24 w-24 rounded-lg object-cover bg-black" />
                <span class="absolute bottom-1 right-1 text-[10px] bg-black/60 text-white rounded px-1">{{ i + 1 }}</span>
              </div>
            </template>
          </div>
          <p class="text-xs text-gray-500">{{ t('ocr.confirm.pages', { n: selectedFiles.length }) }}</p>
          <div class="flex gap-3 justify-end pt-2">
            <button class="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5" @click.stop="cancel">{{ t('action.cancel') }}</button>
            <button class="text-sm font-medium bg-accent text-white px-4 py-2 rounded-lg hover:opacity-90" @click.stop="upload">{{ t('ocr.confirm.send') }}</button>
          </div>
        </div>

        <!-- Lade-Indikator -->
        <div v-else-if="state === 'loading'" class="p-8 flex flex-col items-center gap-4">
          <div class="size-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <p class="text-sm text-gray-400">{{ t('ocr.loading') }}</p>
        </div>

        <!-- Ergebnis-Vorschau -->
        <div v-else-if="state === 'result'" class="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <h3 class="text-sm font-semibold text-white">{{ t('ocr.result.title') }}</h3>
          <pre class="text-xs text-gray-300 bg-white/5 rounded-lg p-4 whitespace-pre-wrap break-words">{{ resultPreview }}</pre>
          <p class="text-xs text-gray-500">{{ t('ocr.result.hint') }}</p>
          <div class="flex gap-3 justify-end pt-2">
            <button class="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5" @click="cancel">{{ t('action.cancel') }}</button>
            <button class="text-sm font-medium bg-accent text-white px-4 py-2 rounded-lg hover:opacity-90" @click="apply">{{ t('ocr.result.apply') }}</button>
          </div>
        </div>

        <!-- Fehler -->
        <div v-else-if="state === 'error'" class="p-6 space-y-4">
          <p class="text-sm text-red-400">{{ errorMsg }}</p>
          <div v-if="rawOutput" class="space-y-1">
            <p class="text-xs text-gray-500">Claude-Rohausgabe:</p>
            <pre class="text-xs text-gray-300 bg-black/30 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap break-all">{{ rawOutput }}</pre>
          </div>
          <div class="flex justify-end">
            <button class="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5" @click="cancel">{{ t('action.close') }}</button>
          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script>
export default { inheritAttrs: false }
</script>

<script setup>
import { ref, computed } from 'vue'
import { useLocale } from '../composables/useLocale.js'
import { ocrShowplan } from '../api/ocr.js'

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
