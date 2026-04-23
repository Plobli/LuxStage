import { ref } from 'vue'
import { fetchShowFloorplan, saveShowFloorplan, saveShowFloorplanSnapshot, uploadShowFloorplanImage, deleteShowFloorplanImage } from '../api/floorplan.js'

export function useShowFloorplan(showId) {
  const floorplan = ref({ image_url: null, canvas_data: null })

  async function loadFloorplan() {
    const data = await fetchShowFloorplan(showId).catch(() => null)
    if (data) floorplan.value = data
  }

  function onFloorplanChange(canvasData, snapshotDataUrl) {
    floorplan.value = { ...floorplan.value, canvas_data: canvasData }
    saveShowFloorplan(showId, canvasData).catch(() => {})
    if (snapshotDataUrl) {
      saveShowFloorplanSnapshot(showId, snapshotDataUrl).catch(() => {})
    }
  }

  async function onFloorplanImageUpload(file) {
    const result = await uploadShowFloorplanImage(showId, file)
    if (result?.image_url) {
      floorplan.value = { ...floorplan.value, image_url: result.image_url }
    }
  }

  async function onFloorplanImageDelete() {
    await deleteShowFloorplanImage(showId)
    floorplan.value = { ...floorplan.value, image_url: null }
  }

  return {
    floorplan,
    loadFloorplan,
    onFloorplanChange,
    onFloorplanImageUpload,
    onFloorplanImageDelete
  }
}
