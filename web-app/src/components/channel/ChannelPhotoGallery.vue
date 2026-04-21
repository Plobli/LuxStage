<template>
  <div class="space-y-2 text-xs">
    <!-- Photo List -->
    <div v-if="photos.length > 0" class="space-y-1">
      <div
        class="space-y-1 border border-border/40 rounded p-1.5 bg-muted/20 max-h-48 overflow-y-auto"
        @dragover.prevent
        @drop.prevent="onDrop"
      >
        <div
          v-for="(photo, idx) in photos"
          :key="photo"
          class="flex items-center gap-1.5 p-1.5 bg-card rounded border border-border/30 group/photo hover:border-border/60 transition-colors"
          draggable="true"
          @dragstart="onDragStart($event, idx)"
          @dragend="onDragEnd"
          @dragover.prevent
          @drop.prevent="onDropPhoto($event, idx)"
        >
          <GripVertical class="size-3 text-muted-foreground/40 group-hover/photo:text-muted-foreground/70 cursor-grab shrink-0" />
          <span class="text-[11px] text-foreground flex-1 truncate font-mono">{{ photo }}</span>
          <button
            @click="removePhoto(photo)"
            class="w-5 h-5 flex items-center justify-center text-muted-foreground opacity-0 group-hover/photo:opacity-100 hover:text-red-400 rounded hover:bg-red-500/10"
            title="Foto entfernen"
          >
            <X class="size-2.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Add Photo -->
    <div class="flex gap-1">
      <input
        type="text"
        v-model="newPhotoFilename"
        placeholder="Foto hinzufügen..."
        class="flex-1 text-[11px] px-1.5 py-1 rounded border border-border/40 bg-background placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 h-7"
        @keydown.enter="addPhoto"
      />
      <button
        @click="addPhoto"
        :disabled="!newPhotoFilename.trim()"
        class="px-2 h-7 rounded bg-primary/80 hover:bg-primary text-primary-foreground text-[11px] font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        +
      </button>
    </div>

    <!-- Available Photos -->
    <select
      v-if="availablePhotos.length > 0"
      @change="quickAddPhoto"
      class="w-full text-[11px] px-1.5 py-1 rounded border border-border/40 bg-background h-7"
    >
      <option value="">Verfügbare Fotos ({{ availablePhotos.length }})</option>
      <option v-for="photo in availablePhotos" :key="photo" :value="photo">
        {{ photo }}
      </option>
    </select>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { GripVertical, Plus, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import * as photosApi from '@/api/photos.js'

const props = defineProps({
  showId: { type: String, required: true },
  channelId: { type: String, required: true },
  allPhotos: { type: Array, default: () => [] },
})

const emit = defineEmits(['update'])

const photos = ref([])
const newPhotoFilename = ref('')
const draggedIndex = ref(null)

const availablePhotos = computed(() => {
  return props.allPhotos.filter(p => !photos.value.includes(p))
})

onMounted(async () => {
  await loadPhotos()
})

async function loadPhotos() {
  try {
    const res = await photosApi.fetchChannelPhotos(props.showId, props.channelId)
    photos.value = res.photos || []
  } catch (err) {
    console.error('Fehler beim Laden der Kanal-Fotos:', err)
  }
}

async function addPhoto() {
  const filename = newPhotoFilename.value.trim()
  if (!filename) return

  try {
    await photosApi.addChannelPhoto(props.showId, props.channelId, filename)
    photos.value.push(filename)
    newPhotoFilename.value = ''
    await saveOrder()
    emit('update')
  } catch (err) {
    console.error('Fehler beim Hinzufügen des Fotos:', err)
  }
}

function quickAddPhoto(e) {
  const filename = e.target.value || e
  if (!filename) return
  newPhotoFilename.value = filename
  addPhoto()
  e.target.value = ''
}

async function removePhoto(filename) {
  try {
    await photosApi.removeChannelPhoto(props.showId, props.channelId, filename)
    photos.value = photos.value.filter(p => p !== filename)
    await saveOrder()
    emit('update')
  } catch (err) {
    console.error('Fehler beim Entfernen des Fotos:', err)
  }
}

async function saveOrder() {
  try {
    await photosApi.reorderChannelPhotos(props.showId, props.channelId, photos.value)
  } catch (err) {
    console.error('Fehler beim Speichern der Reihenfolge:', err)
  }
}

function onDragStart(e, index) {
  draggedIndex.value = index
  e.dataTransfer.effectAllowed = 'move'
}

function onDragEnd() {
  draggedIndex.value = null
}

function onDropPhoto(e, targetIndex) {
  e.preventDefault()
  if (draggedIndex.value === null || draggedIndex.value === targetIndex) return

  const [dragged] = photos.value.splice(draggedIndex.value, 1)
  photos.value.splice(targetIndex, 0, dragged)
  draggedIndex.value = null
  saveOrder()
}

function onDrop(e) {
  e.preventDefault()
  if (draggedIndex.value === null) return
  const [dragged] = photos.value.splice(draggedIndex.value, 1)
  photos.value.push(dragged)
  draggedIndex.value = null
  saveOrder()
}
</script>
