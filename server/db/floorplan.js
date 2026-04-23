import { dbContainer } from '../db-init.js'
import { randomUUID } from 'node:crypto'

function now() { return Date.now() }

export function getTemplateFloorplan(templateId) {
  return dbContainer.db.prepare(
    'SELECT * FROM template_floorplans WHERE template_id = ?'
  ).get(templateId) ?? null
}

export function upsertTemplateFloorplan(templateId, imagePath) {
  const existing = getTemplateFloorplan(templateId)
  if (existing) {
    dbContainer.db.prepare(
      'UPDATE template_floorplans SET image_path = ? WHERE template_id = ?'
    ).run(imagePath, templateId)
  } else {
    dbContainer.db.prepare(
      'INSERT INTO template_floorplans (id, template_id, image_path, created_at) VALUES (?, ?, ?, ?)'
    ).run(randomUUID(), templateId, imagePath, now())
  }
}

export function getShowFloorplan(showId) {
  return dbContainer.db.prepare(
    'SELECT * FROM show_floorplan_layers WHERE show_id = ?'
  ).get(showId) ?? null
}

export function upsertShowFloorplanImage(showId, imagePath) {
  const existing = getShowFloorplan(showId)
  if (existing) {
    dbContainer.db.prepare(
      'UPDATE show_floorplan_layers SET image_path = ?, updated_at = ? WHERE show_id = ?'
    ).run(imagePath, now(), showId)
  } else {
    dbContainer.db.prepare(
      'INSERT INTO show_floorplan_layers (id, show_id, image_path, updated_at) VALUES (?, ?, ?, ?)'
    ).run(randomUUID(), showId, imagePath, now())
  }
}

export function upsertShowFloorplanData(showId, canvasData) {
  const existing = getShowFloorplan(showId)
  if (existing) {
    dbContainer.db.prepare(
      'UPDATE show_floorplan_layers SET canvas_data = ?, updated_at = ? WHERE show_id = ?'
    ).run(canvasData, now(), showId)
  } else {
    dbContainer.db.prepare(
      'INSERT INTO show_floorplan_layers (id, show_id, canvas_data, updated_at) VALUES (?, ?, ?, ?)'
    ).run(randomUUID(), showId, canvasData, now())
  }
}
