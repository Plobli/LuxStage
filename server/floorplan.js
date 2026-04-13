// LuxStage/server/floorplan.js
import fs from 'node:fs/promises'
import path from 'node:path'
import { config } from './config.js'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']

function floorplansDir() {
  return path.join(config.dataPath, 'floorplans')
}

export async function saveFloorplanImage(templateId, filename, buffer, mimeType) {
  if (!ALLOWED_TYPES.includes(mimeType)) {
    throw new Error('Ungültiger Dateityp. Erlaubt: PNG, JPG, SVG, WebP')
  }
  const dir = path.join(floorplansDir(), templateId)
  await fs.mkdir(dir, { recursive: true })

  // Alte Bilder löschen (nur ein Bild pro Template)
  try {
    const existing = await fs.readdir(dir)
    for (const f of existing) await fs.unlink(path.join(dir, f)).catch(() => {})
  } catch {}

  const ext = filename.split('.').pop().toLowerCase().replace('jpeg', 'jpg')
  const safeName = `floorplan.${ext}`
  const finalPath = path.join(dir, safeName)
  const tmpPath = `${finalPath}.tmp`
  await fs.writeFile(tmpPath, buffer)
  await fs.rename(tmpPath, finalPath)
  return path.join(templateId, safeName)
}

export async function deleteFloorplanImage(imagePath) {
  if (!imagePath) return
  const full = path.join(floorplansDir(), imagePath)
  await fs.unlink(full).catch(() => {})
  // Verzeichnis aufräumen falls leer
  await fs.rmdir(path.dirname(full)).catch(() => {})
}

export function floorplanUrl(imagePath) {
  if (!imagePath) return null
  return `/api/floorplans/images/${imagePath}`
}

export async function serveFloorplanImage(imagePath, res) {
  const base = floorplansDir()
  const full = path.resolve(base, imagePath)
  if (!full.startsWith(base + path.sep) && full !== base) return false
  let buffer
  try {
    buffer = await fs.readFile(full)
  } catch {
    return false
  }
  const ext = imagePath.split('.').pop().toLowerCase()
  const mime = ext === 'svg' ? 'image/svg+xml'
    : ext === 'png' ? 'image/png'
    : ext === 'webp' ? 'image/webp'
    : 'image/jpeg'
  res.setHeader('Content-Type', mime)
  res.setHeader('Cache-Control', 'public, max-age=86400')
  res.end(buffer)
  return true
}
