import { api } from './client'

export interface TemplateTowerSlot {
  id: string
  tower_id: string
  slot_index: number
  channel: string | null
  device: string | null
  color: string | null
}

export interface TemplateTower {
  id: string
  template_id: string
  name: string
  side: string
  stage_area: string
  slot_count: number
  sort_order: number
  slots: TemplateTowerSlot[]
}

export async function fetchTemplateTowers(templateName: string): Promise<TemplateTower[]> {
  return api.get(`/api/templates/${encodeURIComponent(templateName)}/towers`)
}

export async function createTemplateTower(templateName: string, data: Partial<TemplateTower>): Promise<{ id: string }> {
  return api.post(`/api/templates/${encodeURIComponent(templateName)}/towers`, data)
}

export async function updateTemplateTower(templateName: string, towerId: string, data: Partial<TemplateTower>): Promise<void> {
  return api.put(`/api/templates/${encodeURIComponent(templateName)}/towers/${towerId}`, data)
}

export async function deleteTemplateTower(templateName: string, towerId: string): Promise<void> {
  return api.delete(`/api/templates/${encodeURIComponent(templateName)}/towers/${towerId}`)
}

export async function reorderTemplateTowers(templateName: string, order: string[]): Promise<void> {
  return api.put(`/api/templates/${encodeURIComponent(templateName)}/towers/reorder`, { order })
}

export async function updateTemplateTowerSlot(
  templateName: string,
  towerId: string,
  slotIndex: number,
  data: { channel?: string | null; device?: string | null; color?: string | null }
): Promise<void> {
  return api.patch(`/api/templates/${encodeURIComponent(templateName)}/towers/${towerId}/slots/${slotIndex}`, data)
}
