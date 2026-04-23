import * as db from '../db.js'
import * as photos from '../photos.js'
import * as floorplan from '../floorplan.js'
import { notFound } from '../helpers.js'
import { generatePDF } from '../pdf.js'

const SHOW_PDF = /^\/api\/shows\/([^/]+)\/pdf$/

export async function pdfRoutes(req, res, pathname) {
  const { method } = req
  let m

  if (method === 'GET' && (m = SHOW_PDF.exec(pathname))) {
    const slug = m[1]
    const show = db.readShow(slug)
    if (!show) return notFound(res)
    const channels = db.readChannels(slug)
    const sectionsMap = db.readShowSections(slug)
    const templateSections = db.readShowSectionDefs(slug)
    const photoFilenames = await photos.listPhotos(slug)
    const captionsMap = db.readPhotoDescriptions(slug)
    const photoEntries = photoFilenames.map(f => ({
      path: photos.getPhotoPath(slug, f),
      caption: captionsMap[f]?.caption ?? '',
    }))
    await generatePDF(show, channels, sectionsMap, templateSections, photoEntries, res, {
      snapshotPath: floorplan.getFloorplanSnapshotPath(show.id),
    })
    return
  }

  return null
}
