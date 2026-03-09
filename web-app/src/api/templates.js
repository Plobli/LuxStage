import { pb } from './pocketbase.js'

export async function fetchTemplates() {
  return await pb.collection('venue_templates').getFullList({
    sort: '-created',
  })
}

export async function fetchTemplate(id) {
  return await pb.collection('venue_templates').getOne(id)
}

export async function fetchTemplateChannels(templateId) {
  return await pb.collection('template_channels').getFullList({
    filter: `template = "${templateId}"`,
    sort: 'created,channel_number',
  })
}

export async function fetchTemplateCustomFields(templateId) {
  return await pb.collection('template_custom_fields').getFullList({
    filter: `template = "${templateId}"`,
    sort: 'created',
  })
}

export async function createTemplate(data, csvFile) {
  const formData = new FormData()
  formData.append('name', data.name)
  formData.append('venue_name', data.venue_name)
  formData.append('version', data.version ?? 1)
  if (csvFile) formData.append('source_file', csvFile)
  return await pb.collection('venue_templates').create(formData)
}

export async function updateTemplate(id, data) {
  return await pb.collection('venue_templates').update(id, data)
}

export async function createTemplateChannel(templateId, channel) {
  return await pb.collection('template_channels').create({
    ...channel,
    template: templateId,
  })
}

export async function createTemplateCustomField(templateId, field) {
  return await pb.collection('template_custom_fields').create({
    ...field,
    template: templateId,
  })
}

export async function deleteTemplateCustomField(id) {
  return await pb.collection('template_custom_fields').delete(id)
}
