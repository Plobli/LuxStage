import { ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { fetchShowSections, saveShowSections, fetchShowSectionDefs } from '../api/sections.js'

export function useShowSections(showId, meta) {
  const sectionDefs = ref([])
  const sectionContents = ref(new Map())
  const sectionsSaving = ref(false)
  let ignoreSectionsSseCount = 0

  const persistSectionsDebounced = useDebounceFn(async () => {
    await doPersistSections()
  }, 50)

  async function persistSections() {
    await doPersistSections()
  }

  async function doPersistSections() {
    sectionsSaving.value = true
    ignoreSectionsSseCount++
    try {
      const sections = [...sectionContents.value.entries()].map(([id, content]) => ({ id, content }))
      await saveShowSections(showId, sections)
      if (meta.value) meta.value.datum = new Date().toISOString().split('T')[0]
    } finally {
      sectionsSaving.value = false
    }
  }

  async function loadSections() {
    const [sections, defs] = await Promise.all([
      fetchShowSections(showId),
      fetchShowSectionDefs(showId)
    ])
    sectionContents.value = new Map((Array.isArray(sections) ? sections : []).map(s => [s.id, s.content]))
    sectionDefs.value = Array.isArray(defs) ? defs : []
  }

  async function handleSectionsSse() {
    if (ignoreSectionsSseCount > 0) { ignoreSectionsSseCount--; return }
    const sections = await fetchShowSections(showId)
    for (const { id, content } of (Array.isArray(sections) ? sections : [])) {
      sectionContents.value.set(id, content)
    }
  }

  return {
    sectionDefs,
    sectionContents,
    sectionsSaving,
    persistSectionsDebounced,
    persistSections,
    loadSections,
    handleSectionsSse
  }
}
