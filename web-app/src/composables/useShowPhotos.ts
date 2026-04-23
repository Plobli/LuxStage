import { ref } from 'vue'
import { fetchPhotos } from '../api/photos'

export function useShowPhotos(showId: string) {
  const photos = ref<any[]>([])

  async function loadPhotos(): Promise<any[]> {
    const photoList = await fetchPhotos(showId)
    photos.value = photoList || []
    return photos.value
  }

  return {
    photos,
    loadPhotos
  }
}

