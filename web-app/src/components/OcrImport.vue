<template>
  <!-- Trigger-Button — Klassen kommen vom Elternelement via $attrs -->
  <label v-bind="$attrs" class="cursor-pointer">
    {{ t('ocr.trigger') }}
    <input ref="fileInput" type="file" accept="image/*" multiple class="sr-only" @change="onFileSelected" />
  </label>

  <!-- Datenschutz-Hinweis + Vorschau-Dialog -->
  <Teleport to="body">
    <div v-if="state !== 'idle'" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70">
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
          <!-- Bildvorschauen -->
          <div class="flex gap-2 overflow-x-auto">
            <div v-for="(url, i) in previewUrls" :key="i" class="relative shrink-0">
              <img :src="url" class="h-24 w-24 rounded-lg object-cover bg-black" />
              <span class="absolute bottom-1 right-1 text-[10px] bg-black/60 text-white rounded px-1">{{ i + 1 }}</span>
            </div>
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

const emit = defineEmits(['import'])
const { t } = useLocale()

const fileInput = ref(null)
const state = ref('idle') // idle | confirm | loading | result | error
const previewUrls = ref([])
const selectedFiles = ref([])
const result = ref(null)
const errorMsg = ref('')

const resultPreview = computed(() => {
  if (!result.value) return ''
  return JSON.stringify(result.value, null, 2)
})

function onFileSelected(e) {
  const files = Array.from(e.target.files || [])
  if (!files.length) return
  selectedFiles.value = files
  previewUrls.value = files.map(f => URL.createObjectURL(f))
  state.value = 'confirm'
  e.target.value = ''
}

async function upload() {
  state.value = 'loading'
  try {
    result.value = await ocrShowplan(selectedFiles.value)
    state.value = 'result'
  } catch (err) {
    errorMsg.value = err.message
    state.value = 'error'
  }
}

function apply() {
  emit('import', result.value)
  cancel()
}

function cancel() {
  previewUrls.value.forEach(url => URL.revokeObjectURL(url))
  state.value = 'idle'
  previewUrls.value = []
  selectedFiles.value = []
  result.value = null
  errorMsg.value = ''
}
</script>
