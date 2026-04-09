/**
 * photos.js — Foto-API v1.1
 * Komprimierung passiert server-seitig (sharp) — kein Canvas mehr nötig.
 */
import { api, getToken } from './client.js'

export async function fetchPhotos(showId) {
  return api.get(`/api/shows/${showId}/photos`)
}

export function uploadPhoto(showId, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE()}/api/shows/${showId}/photos`)
    xhr.setRequestHeader('Authorization', 'Bearer ' + getToken())
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText))
      else reject(new Error(`Upload fehlgeschlagen: ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('Netzwerkfehler'))
    const formData = new FormData()
    formData.append('photo', file, file.name)
    xhr.send(formData)
  })
}

export async function deletePhoto(showId, filename) {
  return api.delete(`/api/shows/${showId}/photos/${filename}`)
}

export async function fetchPhotoCaptions(showId) {
  return api.get(`/api/shows/${showId}/photo-captions`)
}

export async function savePhotoCaption(showId, filename, caption, channelNumber = '') {
  return api.put(`/api/shows/${showId}/photo-captions/${encodeURIComponent(filename)}`, { caption, channelNumber })
}

export function getPhotoUrl(showId, filename) {
  return api.url(`/api/shows/${showId}/photos/${filename}`)
}
