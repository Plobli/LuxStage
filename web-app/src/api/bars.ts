import { api } from './client'

export interface BarFixture {
  id: string
  bar_id: string
  channel_id: string
  position: number
}

export interface Bar {
  id: string
  show_id: string
  name: string
  zug_nr: string
  length_cm: number
  sort_order: number
  fixtures: BarFixture[]
}

export async function fetchBars(showId: string): Promise<Bar[]> {
  return api.get(`/api/shows/${showId}/bars`)
}

export async function createBar(showId: string, data: Partial<Bar>): Promise<{ id: string }> {
  return api.post(`/api/shows/${showId}/bars`, data)
}

export async function updateBar(showId: string, barId: string, data: Partial<Bar>): Promise<void> {
  return api.put(`/api/shows/${showId}/bars/${barId}`, data)
}

export async function deleteBar(showId: string, barId: string): Promise<void> {
  return api.delete(`/api/shows/${showId}/bars/${barId}`)
}

export async function addBarFixture(showId: string, barId: string, channelId: string, position: number): Promise<void> {
  return api.post(`/api/shows/${showId}/bars/${barId}/fixtures`, { channelId, position })
}

export async function removeBarFixture(showId: string, barId: string, channelId: string): Promise<void> {
  return api.delete(`/api/shows/${showId}/bars/${barId}/fixtures/${channelId}`)
}
