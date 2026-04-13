// LuxStage/web-app/src/api/floorplan.js
import { api, BASE, getToken } from './client.js'

export function fetchTemplateFloorplan(templateId) {
  return api.get(`/api/templates/${templateId}/floorplan`)
}

export function deleteTemplateFloorplanImage(templateId) {
  return api.delete(`/api/templates/${templateId}/floorplan/image`)
}

export function uploadTemplateFloorplanImage(templateId, file) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE()}/api/templates/${templateId}/floorplan/image`)
    xhr.setRequestHeader('Authorization', 'Bearer ' + getToken())
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText))
      else {
        let msg = `Upload fehlgeschlagen: ${xhr.status}`
        try { msg += ' — ' + JSON.parse(xhr.responseText).error } catch {}
        reject(new Error(msg))
      }
    }
    xhr.onerror = () => reject(new Error('Netzwerkfehler'))
    const formData = new FormData()
    formData.append('image', file, file.name)
    xhr.send(formData)
  })
}

export function uploadShowFloorplanImage(showId, file) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE()}/api/shows/${showId}/floorplan/image`)
    xhr.setRequestHeader('Authorization', 'Bearer ' + getToken())
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText))
      else {
        let msg = `Upload fehlgeschlagen: ${xhr.status}`
        try { msg += ' — ' + JSON.parse(xhr.responseText).error } catch {}
        reject(new Error(msg))
      }
    }
    xhr.onerror = () => reject(new Error('Netzwerkfehler'))
    const formData = new FormData()
    formData.append('image', file, file.name)
    xhr.send(formData)
  })
}

export function deleteShowFloorplanImage(showId) {
  return api.delete(`/api/shows/${showId}/floorplan/image`)
}

export function fetchShowFloorplan(showId) {
  return api.get(`/api/shows/${showId}/floorplan`)
}

export function saveShowFloorplan(showId, canvasData) {
  return api.put(`/api/shows/${showId}/floorplan`, { canvas_data: canvasData })
}
