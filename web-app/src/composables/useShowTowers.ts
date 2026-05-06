import { ref } from 'vue'
import { fetchTowers, createTower, updateTower, deleteTower as apiDeleteTower, assignTowerSlot, type Tower } from '../api/towers'

export function useShowTowers(showId: string) {
  const towers = ref<Tower[]>([])
  const loading = ref(false)

  async function loadTowers() {
    loading.value = true
    try {
      towers.value = await fetchTowers(showId)
    } finally {
      loading.value = false
    }
  }

  async function addTower(data: Partial<Tower>) {
    const { id } = await createTower(showId, data)
    await loadTowers()
    return id
  }

  async function saveTower(towerId: string, data: Partial<Tower>) {
    await updateTower(showId, towerId, data)
    await loadTowers()
  }

  async function removeTower(towerId: string) {
    await apiDeleteTower(showId, towerId)
    towers.value = towers.value.filter(t => t.id !== towerId)
  }

  async function assignSlot(towerId: string, slotIndex: number, channelId: string | null) {
    await assignTowerSlot(showId, towerId, slotIndex, channelId)
    const tower = towers.value.find(t => t.id === towerId)
    if (!tower) return
    const slot = tower.slots.find(s => s.slot_index === slotIndex)
    if (slot) slot.channel_id = channelId
  }

  function handleTowersSse() {
    loadTowers()
  }

  return { towers, loading, loadTowers, addTower, saveTower, removeTower, assignSlot, handleTowersSse }
}
