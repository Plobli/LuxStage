import { pb } from './pocketbase.js'

export async function fetchPhotos(showId) {
  return await pb.collection('photos').getFullList({
    filter: `show = "${showId}"`,
    sort: '-created',
  })
}

export async function uploadPhoto(showId, file, caption = '') {
  const compressed = await compressImage(file)
  const formData = new FormData()
  formData.append('show', showId)
  formData.append('file', compressed)
  formData.append('caption', caption)
  return await pb.collection('photos').create(formData)
}

export async function updateCaption(id, caption) {
  return await pb.collection('photos').update(id, { caption })
}

export async function deletePhoto(id) {
  return await pb.collection('photos').delete(id)
}

export function getThumbUrl(photo) {
  return pb.files.getURL(photo, photo.file, { thumb: '400x400' })
}

export function getFullUrl(photo) {
  return pb.files.getURL(photo, photo.file)
}

async function compressImage(file) {
  const MAX_SIZE = 1920
  const QUALITY = 0.8
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width <= MAX_SIZE && height <= MAX_SIZE) { resolve(file); return }
      const scale = MAX_SIZE / Math.max(width, height)
      width = Math.round(width * scale)
      height = Math.round(height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', QUALITY)
    }
    img.src = url
  })
}
