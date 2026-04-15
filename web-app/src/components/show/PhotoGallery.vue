<template>
  <section>
    <div class="flex items-center gap-3 mb-4">
      <slot name="heading" />
      <label class="cursor-pointer text-sm text-gray-400 hover:text-white shrink-0">
        + {{ labels.add }}
        <input type="file" accept="image/*" multiple class="sr-only" @change="onFileInput" />
      </label>
    </div>

    <!-- Upload progress -->
    <div v-if="uploadQueue.length > 0" class="mb-3 space-y-1">
      <div v-for="item in uploadQueue" :key="item.name" class="flex items-center gap-2">
        <div class="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all"
            :class="item.error ? 'bg-red-500' : item.done ? 'bg-green-500' : 'bg-accent'"
            :style="{ width: item.progress + '%' }"
          />
        </div>
        <span class="text-xs text-gray-500 w-8 text-right">{{ item.done ? '✓' : item.error ? '✗' : item.progress + '%' }}</span>
      </div>
    </div>

    <!-- Drop zone + grid -->
    <div
      :class="{ 'ring-2 ring-accent ring-inset rounded-lg': dragging }"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <p v-if="photos.length === 0 && !dragging" class="text-sm text-gray-500">{{ labels.empty }}</p>
      <ul role="list" class="grid grid-cols-3 gap-2">
        <li v-for="filename in photos" :key="filename" class="relative group flex flex-col gap-1">
          <div class="aspect-square block w-full overflow-hidden rounded-lg bg-gray-800 cursor-pointer" @click="openLightbox(filename)">
            <img :src="photoUrl(filename)" :alt="filename" class="pointer-events-none object-cover group-hover:opacity-75 w-full h-full" />
          </div>
          <button
            type="button"
            class="absolute top-1 right-1 rounded bg-black/60 px-1 py-0.5 text-xs text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
            @click="onDeletePhoto(filename)"
            :title="labels.delete"
          >✕</button>
          <input
            type="text"
            :value="photoCaptions[filename]?.caption ?? ''"
            :placeholder="labels.captionPlaceholder"
            class="w-full rounded bg-white/5 px-2 py-1 text-xs text-gray-300 placeholder-gray-600 border border-transparent focus:border-white/20 focus:outline-none"
            @blur="onCaptionBlur(filename, $event)"
            @keydown.enter="$event.target.blur()"
          />
          <div class="flex items-center gap-1 mt-1">
            <span class="text-xs text-gray-600 shrink-0">{{ labels.channelLabel }}</span>
            <input
              type="text"
              :value="photoCaptions[filename]?.channelNumber ?? ''"
              :placeholder="labels.channelPlaceholder"
              class="w-full rounded bg-white/5 px-2 py-1 text-xs text-gray-300 placeholder-gray-600 border border-transparent focus:border-white/20 focus:outline-none"
              @blur="onChannelNumberBlur(filename, $event)"
              @keydown.enter="$event.target.blur()"
            />
          </div>
        </li>
      </ul>
    </div>
  </section>

  <!-- Print pages (only visible when printing) -->
  <div v-if="photos.length > 0" class="photo-print-pages">
    <div v-for="(page, pageIdx) in photoPages" :key="pageIdx" class="photo-print-page">
      <div class="photo-print-grid" :data-cols="photoCols">
        <div v-for="filename in page" :key="filename" class="photo-print-item">
          <img :src="photoUrl(filename)" :alt="photoCaptions[filename]?.caption || filename" />
          <p v-if="photoCaptions[filename]?.caption" class="photo-print-caption">{{ photoCaptions[filename].caption }}</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Lightbox -->
  <Transition
    enter-active-class="transition-opacity duration-200"
    leave-active-class="transition-opacity duration-150"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div
      v-if="lightboxPhoto"
      class="fixed inset-0 z-50 flex flex-col items-center justify-center"
      @click="lightboxPhoto = null"
    >
      <div class="absolute inset-0 backdrop-blur-xl bg-black/70" />
      <button
        v-if="lightboxIndex > 0"
        class="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-white/70 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-2 transition-colors"
        @click.stop="lightboxStep(-1)"
        aria-label="Vorheriges Foto"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
      </button>
      <img :src="photoUrl(lightboxPhoto)" class="relative max-h-[85vh] max-w-[90vw] object-contain drop-shadow-2xl" @click.stop />
      <p
        v-if="photoCaptions[lightboxPhoto]?.caption"
        class="relative mt-3 text-sm text-gray-300 max-w-lg text-center px-4"
        @click.stop
      >{{ photoCaptions[lightboxPhoto].caption }}</p>
      <button
        v-if="lightboxIndex < photos.length - 1"
        class="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-white/70 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-2 transition-colors"
        @click.stop="lightboxStep(1)"
        aria-label="Nächstes Foto"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
      </button>
      <button
        class="absolute top-3 right-3 z-10 text-white/70 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-1.5 transition-colors"
        @click.stop="lightboxPhoto = null"
        aria-label="Schließen"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useConfirm } from '../../composables/useConfirm.js'
import { useLocale } from '../../composables/useLocale.js'
import { usePhotoSettings } from '../../composables/usePhotoSettings.js'
import { uploadPhoto, deletePhoto, fetchPhotos, fetchPhotoCaptions, savePhotoCaption } from '../../api/photos.js'
import { getPhotoUrl } from '../../api/photos.js'

const props = defineProps({
  showId: { type: String, required: true },
  photos: { type: Array, required: true },
  labels: {
    type: Object,
    default: () => ({
      add: 'Foto hinzufügen',
      empty: 'Keine Fotos',
      delete: 'Löschen',
      captionPlaceholder: 'Beschriftung',
      channelLabel: 'Kanal:',
      channelPlaceholder: 'z. B. 42',
    }),
  },
})

const emit = defineEmits(['update:photos'])

const { confirm } = useConfirm()
const { t } = useLocale()
const { photosPerPage } = usePhotoSettings()

const dragging = ref(false)
const lightboxPhoto = ref(null)
const uploadQueue = ref([])
const photoCaptions = ref({})

const photoPages = computed(() => {
  const n = photosPerPage.value
  const pages = []
  for (let i = 0; i < props.photos.length; i += n) {
    pages.push(props.photos.slice(i, i + n))
  }
  return pages
})

const photoCols = computed(() => {
  const n = photosPerPage.value
  if (n === 1) return 1
  if (n === 2) return 2
  if (n <= 4) return 2
  if (n <= 6) return 3
  return 3
})

function photoUrl(filename) {
  return getPhotoUrl(props.showId, filename)
}

onMounted(async () => {
  try {
    const caps = await fetchPhotoCaptions(props.showId)
    const map = {}
    if (Array.isArray(caps)) {
      for (const c of caps) map[c.filename] = c
    } else if (caps && typeof caps === 'object') {
      // Fallback falls das Backend ein Objekt statt eines Arrays liefert
      Object.assign(map, caps)
    }
    photoCaptions.value = map
  } catch (e) {
    console.error('Fehler beim Laden der Fotobeschriftungen:', e)
  }
})

async function onCaptionBlur(filename, event) {
  const caption = event.target.value
  photoCaptions.value[filename] = { ...(photoCaptions.value[filename] ?? {}), caption }
  await savePhotoCaption(props.showId, filename, caption, photoCaptions.value[filename]?.channelNumber ?? '')
}

async function onChannelNumberBlur(filename, event) {
  const channelNumber = event.target.value
  photoCaptions.value[filename] = { ...(photoCaptions.value[filename] ?? {}), channelNumber }
  await savePhotoCaption(props.showId, filename, photoCaptions.value[filename]?.caption ?? '', channelNumber)
}

async function uploadFiles(files) {
  uploadQueue.value = files.map(f => ({ name: f.name, progress: 0, done: false, error: false }))
  for (let i = 0; i < files.length; i++) {
    try {
      await uploadPhoto(props.showId, files[i], (p) => {
        uploadQueue.value[i].progress = p
      })
      uploadQueue.value[i].done = true
      emit('update:photos', await fetchPhotos(props.showId))
    } catch {
      uploadQueue.value[i].error = true
    }
  }
  setTimeout(() => { uploadQueue.value = [] }, 2000)
}

function onFileInput(e) { uploadFiles([...e.target.files]); e.target.value = '' }
function onDrop(e) {
  dragging.value = false
  const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'))
  if (files.length) uploadFiles(files)
}

async function onDeletePhoto(filename) {
  const ok = await confirm({ t, titleKey: 'show.photo.delete.confirm', confirmKey: 'action.delete', cancelKey: 'action.cancel' })
  if (!ok) return
  await deletePhoto(props.showId, filename)
  emit('update:photos', props.photos.filter(f => f !== filename))
  delete photoCaptions.value[filename]
}

const lightboxIndex = computed(() => props.photos.indexOf(lightboxPhoto.value))
function openLightbox(filename) { lightboxPhoto.value = filename }
function lightboxStep(dir) {
  const idx = lightboxIndex.value + dir
  if (idx >= 0 && idx < props.photos.length) lightboxPhoto.value = props.photos[idx]
}

function onLightboxKey(e) {
  if (!lightboxPhoto.value) return
  if (e.key === 'ArrowRight') lightboxStep(1)
  else if (e.key === 'ArrowLeft') lightboxStep(-1)
  else if (e.key === 'Escape') lightboxPhoto.value = null
}

onMounted(() => window.addEventListener('keydown', onLightboxKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onLightboxKey))
</script>
