/**
 * pdf.js — Einleuchtplan PDF-Export
 * Layout entspricht dem bisherigen Word-Plan:
 * Kanäle nach Position gruppiert, mit Abschnitts-Überschriften
 */
import PDFDocument from 'pdfkit'

// Spaltenbreiten (mm → pt: 1mm ≈ 2.835pt)
const mm = (v) => v * 2.835
const PAGE_MARGIN = mm(15)
const COL = {
  channel:  mm(14),
  device:   mm(44),
  color:    mm(28),
  address:  mm(22),
  category: mm(26),
  notes:    0, // Rest
}
const ROW_H = mm(6)
const HEADER_H = mm(8)
const FONT_NORMAL = 'Helvetica'
const FONT_BOLD   = 'Helvetica-Bold'

export function generatePDF(showContent, channelsCsv, res) {
  const fm = parseFrontmatter(showContent)
  const channels = parseCsv(channelsCsv)
  const grouped = groupByPosition(channels)

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: PAGE_MARGIN })
  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="einleuchtplan-${fm.name || 'show'}.pdf"`,
  })
  doc.pipe(res)

  const pageW = doc.page.width
  const usableW = pageW - PAGE_MARGIN * 2
  COL.notes = usableW - Object.values(COL).reduce((a, b) => a + b, 0)

  // ── Titelseite / Header ──────────────────────────────────────────────────
  doc.font(FONT_BOLD).fontSize(16)
    .text(`Einleuchtplan — ${fm.name || ''}`, PAGE_MARGIN, PAGE_MARGIN)
  doc.font(FONT_NORMAL).fontSize(10)
    .text(`${fm.venue || ''}   |   ${fmt(fm.datum)}`, PAGE_MARGIN, PAGE_MARGIN + mm(8))
  doc.moveDown(1.5)

  // ── Pro Gruppe: Überschrift + Tabelle ────────────────────────────────────
  let y = doc.y
  for (const [position, rows] of grouped) {
    // Prüfen ob noch Platz für Überschrift + mind. 2 Zeilen
    const needed = HEADER_H + ROW_H * 3
    if (y + needed > doc.page.height - PAGE_MARGIN) {
      doc.addPage()
      y = PAGE_MARGIN
    }

    // Gruppen-Überschrift
    doc.rect(PAGE_MARGIN, y, usableW, HEADER_H).fill('#2c2c2c')
    doc.fill('white').font(FONT_BOLD).fontSize(9)
      .text(position, PAGE_MARGIN + mm(2), y + mm(1.8), { width: usableW - mm(4) })
    doc.fill('black')
    y += HEADER_H

    // Spalten-Header
    y = drawRow(doc, y, usableW, [
      { text: 'Ch', w: COL.channel },
      { text: 'Gerät', w: COL.device },
      { text: 'Filter', w: COL.color },
      { text: 'Adresse', w: COL.address },
      { text: 'Kategorie', w: COL.category },
      { text: 'Notizen', w: COL.notes },
    ], true)

    // Datenzeilen
    for (const row of rows) {
      if (y + ROW_H > doc.page.height - PAGE_MARGIN) {
        doc.addPage()
        y = PAGE_MARGIN
        // Gruppen-Header wiederholen
        doc.rect(PAGE_MARGIN, y, usableW, HEADER_H).fill('#555')
        doc.fill('white').font(FONT_BOLD).fontSize(8)
          .text(`${position} (Forts.)`, PAGE_MARGIN + mm(2), y + mm(2))
        doc.fill('black')
        y += HEADER_H
        y = drawRow(doc, y, usableW, [
          { text: 'Ch', w: COL.channel },
          { text: 'Gerät', w: COL.device },
          { text: 'Filter', w: COL.color },
          { text: 'Adresse', w: COL.address },
          { text: 'Kategorie', w: COL.category },
          { text: 'Notizen', w: COL.notes },
        ], true)
      }
      y = drawRow(doc, y, usableW, [
        { text: row.channel, w: COL.channel },
        { text: row.device,  w: COL.device },
        { text: row.color,   w: COL.color },
        { text: row.address, w: COL.address },
        { text: row.category,w: COL.category },
        { text: row.notes,   w: COL.notes },
      ], false)
    }
    y += mm(3) // Abstand nach Gruppe
  }

  doc.end()
}

// ── Helpers ────────────────────────────────────────────────────────────────

function drawRow(doc, y, usableW, cols, isHeader) {
  if (isHeader) {
    doc.rect(PAGE_MARGIN, y, usableW, ROW_H).fill('#e8e8e8')
    doc.fill('black')
  }
  // Horizontale Linie
  doc.rect(PAGE_MARGIN, y, usableW, ROW_H).stroke('#cccccc')

  let x = PAGE_MARGIN
  for (const col of cols) {
    doc.font(isHeader ? FONT_BOLD : FONT_NORMAL).fontSize(isHeader ? 7.5 : 8)
      .text(col.text || '', x + mm(1), y + mm(1.3), {
        width: col.w - mm(2),
        height: ROW_H - mm(1),
        lineBreak: false,
        ellipsis: true,
      })
    x += col.w
  }
  return y + ROW_H
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const result = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    result[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^"|"$/g, '')
  }
  return result
}

function parseCsv(csv) {
  const lines = csv.trim().split('\n')
  if (!lines.length) return []
  const headers = lines[0].split(';').map(h => h.trim())
  return lines.slice(1).map(line => {
    const vals = line.split(';')
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] || '').trim()]))
  })
}

function groupByPosition(channels) {
  const map = new Map()
  for (const ch of channels) {
    const pos = ch.position || 'Sonstiges'
    if (!map.has(pos)) map.set(pos, [])
    map.get(pos).push(ch)
  }
  return map
}

function fmt(dateStr) {
  if (!dateStr) return ''
  try { return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return dateStr }
}
