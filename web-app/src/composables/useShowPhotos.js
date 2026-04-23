import { ref } from 'vue'
import { fetchPhotos } from '../api/photos.js'

export function useShowPhotos(showId) {
  const photos = ref([])

  async function loadPhotos() {
    const photoList = await fetchPhotos(showId)
    photos.value = photoList || []
    return photos.value
  }

  return {
    photos,
    loadPhotos
  }
}
