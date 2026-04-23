import { ref, watch, type Ref } from 'vue'

const STORAGE_KEY = 'photo_print_per_page'
const VALID = [1, 2, 4, 6, 8, 9, 12]

const storedStr = localStorage.getItem(STORAGE_KEY)
const stored = storedStr ? parseInt(storedStr, 10) : NaN
const photosPerPage = ref<number>(VALID.includes(stored) ? stored : 4)

watch(photosPerPage, v => localStorage.setItem(STORAGE_KEY, String(v)))

export function usePhotoSettings(): { photosPerPage: Ref<number>, VALID: number[] } {
  return { photosPerPage, VALID }
}

