import { ref, type Ref } from 'vue'
import { fetchTowers, createTower, updateTower, deleteTower as apiDeleteTower, assignTowerSlot, type Tower } from '../api/towers'
import type { Channel } from '../api/channels'

export function useShowTowers(showId: string, channels?: Ref<Channel[]>) {
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

    // Clear old channel that had this slot
    if (channels?.value) {
      for (const ch of channels.value) {
        if (!ch.mount_ref) continue
        try {
          const ref = typeof ch.mount_ref === 'string' ? JSON.parse(ch.mount_ref) : ch.mount_ref
          if (ref?.towerId === towerId && ref?.slotIndex === slotIndex) {
            ch.mount_ref = null
          }
        } catch {}
      }
    }

    const slot = tower.slots.find(s => s.slot_index === slotIndex)
    if (slot) {
      const oldChannelId = slot.channel_id
      slot.channel_id = channelId

      // Update mount_ref on the new channel
      if (channelId && channels?.value) {
        const ch = channels.value.find(c => c.id === channelId)
        if (ch) {
          ch.mount_ref = JSON.stringify({
            type: 'tower',
            towerId,
            towerName: tower.name,
            slotIndex,
          })
        }
      }
    }
  }

  function handleTowersSse() {
    loadTowers()
  }

  return { towers, loading, loadTowers, addTower, saveTower, removeTower, assignSlot, handleTowersSse }
}
