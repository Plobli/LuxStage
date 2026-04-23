import { ref } from 'vue'
import { fetchShowFloorplan, saveShowFloorplan, saveShowFloorplanSnapshot, uploadShowFloorplanImage, deleteShowFloorplanImage } from '../api/floorplan'

export interface FloorplanData {
  image_url: string | null;
  canvas_data: any | null;
}

export function useShowFloorplan(showId: string) {
  const floorplan = ref<FloorplanData>({ image_url: null, canvas_data: null })

  async function loadFloorplan(): Promise<void> {
    const data = await fetchShowFloorplan(showId).catch(() => null)
    if (data) floorplan.value = data
  }

  function onFloorplanChange(canvasData: any, snapshotDataUrl?: string): void {
    floorplan.value = { ...floorplan.value, canvas_data: canvasData }
    saveShowFloorplan(showId, canvasData).catch(() => {})
    if (snapshotDataUrl) {
      saveShowFloorplanSnapshot(showId, snapshotDataUrl).catch(() => {})
    }
  }

  async function onFloorplanImageUpload(file: File): Promise<void> {
    const result = await uploadShowFloorplanImage(showId, file)
    if (result?.image_url) {
      floorplan.value = { ...floorplan.value, image_url: result.image_url }
    }
  }

  async function onFloorplanImageDelete(): Promise<void> {
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

