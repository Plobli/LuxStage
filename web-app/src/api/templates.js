import { api } from './client.js'
import { parseCsv, serializeCsv } from './channels.js'

export const fetchTemplates = ()           => api.get('/api/templates')
export const deleteTemplate = (name)       => api.delete(`/api/templates/${name}`)

export async function fetchTemplateChannels(name) {
  const { csv } = await api.get(`/api/templates/${name}`)
  return parseCsv(csv)
}

export async function saveTemplate(name, channels) {
  return api.put(`/api/templates/${name}`, { csv: serializeCsv(channels) })
}

export async function uploadTemplate({ name, text }) {
  return api.put(`/api/templates/${name}`, { csv: text })
}
