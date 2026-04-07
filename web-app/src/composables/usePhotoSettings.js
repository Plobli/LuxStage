import { ref, watch } from 'vue'

const STORAGE_KEY = 'photo_print_per_page'
const VALID = [1, 2, 4, 6, 8, 9, 12]

const stored = parseInt(localStorage.getItem(STORAGE_KEY), 10)
const photosPerPage = ref(VALID.includes(stored) ? stored : 4)

watch(photosPerPage, v => localStorage.setItem(STORAGE_KEY, v))

export function usePhotoSettings() {
  return { photosPerPage, VALID }
}
