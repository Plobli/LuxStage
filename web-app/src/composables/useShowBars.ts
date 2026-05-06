import { ref, type Ref } from 'vue'
import { fetchBars, createBar, updateBar, deleteBar as apiDeleteBar, addBarFixture, removeBarFixture, type Bar } from '../api/bars'
import type { Channel } from '../api/channels'

export function useShowBars(showId: string, channels?: Ref<Channel[]>) {
  const bars = ref<Bar[]>([])
  const loading = ref(false)

  async function loadBars() {
    loading.value = true
    try {
      bars.value = await fetchBars(showId)
    } finally {
      loading.value = false
    }
  }

  async function addBar(data: Partial<Bar>) {
    const { id } = await createBar(showId, data)
    await loadBars()
    return id
  }

  async function saveBar(barId: string, data: Partial<Bar>) {
    await updateBar(showId, barId, data)
    await loadBars()
  }

  async function removeBar(barId: string) {
    await apiDeleteBar(showId, barId)
    bars.value = bars.value.filter(b => b.id !== barId)
  }

  async function assignFixture(barId: string, channelId: string, position: number) {
    await addBarFixture(showId, barId, channelId, position)
    const bar = bars.value.find(b => b.id === barId)
    if (!bar) return

    const existing = bar.fixtures.find(f => f.channel_id === channelId)
    if (existing) {
      existing.position = position
    } else {
      bar.fixtures.push({ id: '', bar_id: barId, channel_id: channelId, position })
      bar.fixtures.sort((a, b) => a.position - b.position)
    }

    if (channels?.value) {
      const ch = channels.value.find(c => c.id === channelId)
      if (ch) {
        ch.mount_ref = JSON.stringify({
          type: 'bar',
          barId,
          barName: bar.name,
          zugNr: bar.zug_nr,
          position,
        })
      }
    }
  }

  async function unassignFixture(barId: string, channelId: string) {
    await removeBarFixture(showId, barId, channelId)
    const bar = bars.value.find(b => b.id === barId)
    if (bar) bar.fixtures = bar.fixtures.filter(f => f.channel_id !== channelId)

    if (channels?.value) {
      const ch = channels.value.find(c => c.id === channelId)
      if (ch) ch.mount_ref = null
    }
  }

  return { bars, loading, loadBars, addBar, saveBar, removeBar, assignFixture, unassignFixture }
}
