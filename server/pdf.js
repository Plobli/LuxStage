/**
 * pdf.js — Einleuchtplan PDF-Export
 * Layout entspricht dem bisherigen Word-Plan:
 * Kanäle nach Position gruppiert, mit Abschnitts-Überschriften
 */
import PDFDocument from 'pdfkit'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const filtersData = JSON.parse(fs.readFileSync(join(__dirname, '../shared/filters.json'), 'utf8'))

// Build lookup: code → hex (same logic as filterColors.js in web-app)
const FILTER_HEX = {}
for (const f of filtersData) {
  if (!f.hex) continue
  FILTER_HEX[f.code] = f.hex
  if (f.equivalent) FILTER_HEX[f.equivalent] = f.hex
}

// Spaltenbreiten (mm → pt: 1mm ≈ 2.835pt)
const mm = (v) => v * 2.835
const PAGE_MARGIN = mm(15)
const COL = {
  channel:  mm(12),
  color:    mm(20),
  address:  mm(16),
  device:   mm(35),
  notes:    0, // Rest (gesamte verbleibende Breite)
}
const ROW_MIN_H = mm(6)
const HEADER_H  = mm(7)
const GROUP_H   = mm(6)
const FONT_NORMAL = 'Helvetica'
const FONT_BOLD   = 'Helvetica-Bold'
const COLOR_SWATCH_R = mm(2)

function leeHex(input) {
  if (!input) return null
  const s = input.trim().toUpperCase()
  if (FILTER_HEX[s]) return FILTER_HEX[s]
  // Normalize padding: "L147" → "L147", "147" → "L147"
  const num = s.match(/^[LR]?(\d+)$/)
  if (num) {
    const lee = `L${num[1].padStart(3, '0')}`
    if (FILTER_HEX[lee]) return FILTER_HEX[lee]
    const rosco = `R${num[1].padStart(2, '0')}`
    if (FILTER_HEX[rosco]) return FILTER_HEX[rosco]
  }
  return null
}

function contrastColor(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
  return (0.299*r + 0.587*g + 0.114*b)/255 > 0.5 ? '#000000' : '#ffffff'
}

// show: { name, datum, untertitel, ... }
// channels: [{ channel, address, device, position, color, notes }]
// sectionsMap: Map<sectionId, contentString>  (from db.readShowSections)
// templateSections: [{ id, title, order, type }]
// photoEntries: [{ path, caption }]  — Fotos mit optionaler Beschreibung
export function generatePDF(show, channels, sectionsMap, templateSections, photoEntries, res) {
  const fm = { name: show.name, datum: show.datum, venue: show.untertitel }
  const grouped = groupByPosition(channels)

  const hasSections = Array.isArray(templateSections) && templateSections.length > 0
  const sectionContents = hasSections ? sectionsMap : null
  const sortedSections = hasSections
    ? [...templateSections].sort((a, b) => a.order - b.order)
    : null

  const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: PAGE_MARGIN, autoFirstPage: true })
  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="einleuchtplan-${fm.name || 'show'}.pdf"`,
  })
  doc.pipe(res)

  const pageW = doc.page.width
  const pageH = doc.page.height
  const usableW = pageW - PAGE_MARGIN * 2
  COL.notes = usableW - COL.channel - COL.color - COL.address - COL.device

  const FOOTER_H = mm(8)
  const printableBottom = pageH - PAGE_MARGIN - FOOTER_H

  // Fußzeile auf jede Seite zeichnen
  const printedAt = new Date().toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' })
  let pageNum = 0
  function addFooter() {
    pageNum++
    const y = pageH - PAGE_MARGIN - mm(4)
    doc.font(FONT_NORMAL).fontSize(7).fillColor('#888888')
      .text(`${fm.name || ''} — ${fmt(fm.datum)}`, PAGE_MARGIN, y, { width: usableW / 2 })
      .text(`Seite ${pageNum}  |  ${printedAt}`, PAGE_MARGIN + usableW / 2, y, {
        width: usableW / 2, align: 'right'
      })
    doc.fillColor('black')
  }
  addFooter()
  doc.on('pageAdded', addFooter)

  // ── Titel ────────────────────────────────────────────────────────────────
  doc.font(FONT_BOLD).fontSize(16).fillColor('black')
    .text(`Einleuchtplan — ${fm.name || ''}`, PAGE_MARGIN, PAGE_MARGIN)
  doc.font(FONT_NORMAL).fontSize(10)
    .text(`${fm.venue || ''}   |   ${fmt(fm.datum)}`, PAGE_MARGIN, PAGE_MARGIN + mm(8))
  doc.moveDown(1.5)

  // ── Sections ─────────────────────────────────────────────────────────────
  if (hasSections) {
    for (const sec of sortedSections) {
      const content = sectionContents.get(sec.id) ?? ''
      if (!content.trim()) continue
      doc.font(FONT_BOLD).fontSize(11).text(sec.title, PAGE_MARGIN, doc.y)
      doc.moveDown(0.4)
      if (sec.type === 'fields') {
        renderFieldsSection(doc, sec.fields, content, PAGE_MARGIN, usableW)
      } else {
        const blocks = parseSetupSection(content)
        if (blocks.length) renderSetupBlocks(doc, blocks, PAGE_MARGIN, usableW)
      }
      doc.moveDown(1)
    }
  } else {
    const setupBlocks = parseSetupSection(showContent.replace(/^---\n[\s\S]*?\n---\n/, ''))
    if (setupBlocks.length) {
      doc.font(FONT_BOLD).fontSize(11).text('Aufbau', PAGE_MARGIN, doc.y)
      doc.moveDown(0.5)
      renderSetupBlocks(doc, setupBlocks, PAGE_MARGIN, usableW)
      doc.moveDown(1.5)
    }
  }

  // ── Pro Gruppe: Überschrift + Tabelle ────────────────────────────────────
  const headerCols = [
    { text: 'Ch',      w: COL.channel },
    { text: 'Filter',  w: COL.color,   color: undefined }, // color key present → Filter-Spalte, aber isHeader überschreibt
    { text: 'Adresse', w: COL.address },
    { text: 'Gerät',   w: COL.device },
    { text: 'Notizen', w: COL.notes },
  ]

  let y = doc.y
  for (const [position, rows] of grouped) {
    const filteredRows = rows.filter(r => r.notes?.trim())
    if (!filteredRows.length) continue

    // Präventiver Seitenumbruch: Überschrift + Spaltenheader + mind. 1 Zeile müssen passen
    const minNeeded = GROUP_H + ROW_MIN_H + ROW_MIN_H
    if (y + minNeeded > printableBottom) {
      doc.addPage()
      y = PAGE_MARGIN
    }

    // Positions-Überschrift — dezent: kleine graue Trennlinie statt dunkler Block
    doc.rect(PAGE_MARGIN, y, usableW, GROUP_H).fill('#f0f0f0')
    doc.fill('#555555').font(FONT_BOLD).fontSize(7.5)
      .text(position.toUpperCase(), PAGE_MARGIN + mm(2), y + mm(1.6), { width: usableW - mm(4) })
    doc.fill('black')
    y += GROUP_H

    // Spalten-Header
    y = drawRow(doc, y, usableW, headerCols, true)

    // Datenzeilen
    for (const row of filteredRows) {
      const rowCols = [
        { text: row.channel, w: COL.channel, bold: true },
        { text: row.color,   w: COL.color,   color: row.color },
        { text: row.address, w: COL.address, wrap: true },
        { text: row.device,  w: COL.device,  wrap: true },
        { text: row.notes,   w: COL.notes,   wrap: true },
      ]
      const rowH = calcRowHeight(doc, rowCols)
      if (y + rowH > printableBottom) {
        doc.addPage()
        y = PAGE_MARGIN
        // Gruppen-Header wiederholen
        doc.rect(PAGE_MARGIN, y, usableW, GROUP_H).fill('#f0f0f0')
        doc.fill('#555555').font(FONT_BOLD).fontSize(7.5)
          .text(`${position.toUpperCase()} (Forts.)`, PAGE_MARGIN + mm(2), y + mm(1.6))
        doc.fill('black')
        y += GROUP_H
        y = drawRow(doc, y, usableW, headerCols, true)
      }
      y = drawRow(doc, y, usableW, rowCols, false)
    }
    y += mm(3)
  }

  // ── Foto-Abschnitt ────────────────────────────────────────────────────────
  const validPhotos = (photoEntries ?? []).filter(e => {
    try { fs.accessSync(e.path); return true } catch { return false }
  })

  if (validPhotos.length > 0) {
    doc.addPage()
    y = PAGE_MARGIN

    // Überschrift
    doc.font(FONT_BOLD).fontSize(13).fillColor('black')
      .text('Fotos', PAGE_MARGIN, y)
    y += mm(10)

    const PHOTOS_PER_PAGE = 4
    const COLS = 2
    const ROWS = 2
    const PHOTO_GAP = mm(6)
    const CAPTION_H = mm(8)
    const photoW = (usableW - PHOTO_GAP) / COLS
    const photoH = (printableBottom - y - (ROWS - 1) * PHOTO_GAP - ROWS * CAPTION_H) / ROWS

    let col = 0
    let row = 0
    let photoOnPage = 0

    for (let i = 0; i < validPhotos.length; i++) {
      if (photoOnPage > 0 && photoOnPage % PHOTOS_PER_PAGE === 0) {
        doc.addPage()
        y = PAGE_MARGIN
        row = 0
        col = 0
      }

      const x = PAGE_MARGIN + col * (photoW + PHOTO_GAP)
      const imgY = y + row * (photoH + CAPTION_H + PHOTO_GAP)

      try {
        doc.image(validPhotos[i].path, x, imgY, { width: photoW, height: photoH, fit: [photoW, photoH], align: 'center', valign: 'center' })
      } catch { /* Bild nicht lesbar → überspringen */ }

      // Beschriftung unter dem Foto
      const caption = validPhotos[i].caption?.trim() ?? ''
      if (caption) {
        doc.font(FONT_NORMAL).fontSize(7.5).fillColor('#444444')
          .text(caption, x, imgY + photoH + mm(1.5), { width: photoW, lineBreak: false, ellipsis: true })
        doc.fillColor('black')
      }

      col++
      if (col >= COLS) { col = 0; row++ }
      photoOnPage++
    }
  }

  doc.end()
}

// ── Helpers ────────────────────────────────────────────────────────────────

function calcRowHeight(doc, cols) {
  doc.font(FONT_NORMAL).fontSize(8)
  let maxH = ROW_MIN_H
  for (const col of cols) {
    if (!col.wrap || !col.text) continue
    const h = doc.heightOfString(col.text, { width: col.w - mm(2) }) + mm(2.6)
    if (h > maxH) maxH = h
  }
  return maxH
}

function drawRow(doc, y, usableW, cols, isHeader) {
  const rowH = isHeader ? ROW_MIN_H : calcRowHeight(doc, cols)

  // Hintergrund Header: sehr helles Grau, keine Außenbox
  if (isHeader) {
    doc.rect(PAGE_MARGIN, y, usableW, rowH).fill('#f4f4f4')
    doc.fill('black')
  }

  // Nur obere + untere Linie (keine Seitenrahmen)
  doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + usableW, y).stroke('#dddddd')
  doc.moveTo(PAGE_MARGIN, y + rowH).lineTo(PAGE_MARGIN + usableW, y + rowH).stroke('#dddddd')

  let x = PAGE_MARGIN
  for (const col of cols) {
    const textX = x + mm(1.5)
    const textW = col.w - mm(3)
    const FONT_SIZE = isHeader ? 7 : 8
    doc.font(FONT_NORMAL).fontSize(FONT_SIZE)

    if (isHeader) {
      // Header: normale Schrift, grau, vertikal zentriert
      const textH = doc.currentLineHeight()
      const textY = y + (rowH - textH) / 2
      doc.fillColor('#666666')
        .text(col.text || '', textX, textY, { width: textW, lineBreak: false, ellipsis: true })
      doc.fillColor('black')
    } else if (col.bold) {
      // Kanal-Nummer: fett, vertikal zentriert
      doc.font(FONT_BOLD).fontSize(FONT_SIZE)
      const textH = doc.currentLineHeight()
      const textY = y + (rowH - textH) / 2
      doc.fillColor('black')
        .text(col.text || '', textX, textY, { width: textW, lineBreak: false, ellipsis: true })
    } else if (col.color !== undefined) {
      // Filter-Spalte: Kreis + Code
      const hex = leeHex(col.color)
      const cy = y + rowH / 2
      if (hex) {
        const cx = x + COLOR_SWATCH_R + mm(1.5)
        doc.circle(cx, cy, COLOR_SWATCH_R).fill(hex)
        // dünner Ring
        doc.save().circle(cx, cy, COLOR_SWATCH_R).lineWidth(0.3).stroke('#aaaaaa').restore()
        doc.fill('black')
        const codeX = cx + COLOR_SWATCH_R + mm(1)
        const textH = doc.font(FONT_NORMAL).fontSize(FONT_SIZE).currentLineHeight()
        const textY = y + (rowH - textH) / 2
        doc.fillColor('black')
          .text(col.text || '', codeX, textY, {
            width: col.w - (codeX - x) - mm(1),
            lineBreak: false, ellipsis: true,
          })
      } else {
        // Kein bekannter Lee-Filter: Text zentriert, dezent grau
        const textH = doc.currentLineHeight()
        const textY = y + (rowH - textH) / 2
        doc.fillColor(col.text ? '#444444' : '#aaaaaa')
          .text(col.text || '—', textX, textY, { width: textW, lineBreak: false, ellipsis: true })
        doc.fillColor('black')
      }
    } else if (col.wrap) {
      // Mehrzeilige Spalten: vertikal oben ausrichten mit Padding
      const textY = y + mm(1.5)
      doc.fillColor('black')
        .text(col.text || '', textX, textY, { width: textW, lineBreak: true })
    } else {
      // Standard: vertikal zentriert
      const textH = doc.currentLineHeight()
      const textY = y + (rowH - textH) / 2
      doc.fillColor('black')
        .text(col.text || '', textX, textY, { width: textW, lineBreak: false, ellipsis: true })
    }
    x += col.w
  }
  return y + rowH
}

function renderFieldsSection(doc, fields, raw, margin, usableW) {
  const colLabelW = mm(45)
  const colValueW = usableW - colLabelW
  const rowH = mm(5.5)
  let y = doc.y
  for (const field of fields) {
    const escapedKey = field.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`^${escapedKey}:\\s*(.*)$`, 'm')
    const match = raw.match(re)
    const value = match ? match[1].trim() : ''
    if (!value) continue
    doc.rect(margin, y, usableW, rowH).stroke('#cccccc')
    doc.font(FONT_BOLD).fontSize(8)
      .text(field.label + (field.unit ? ` (${field.unit})` : ''), margin + mm(1.5), y + mm(1.2), {
        width: colLabelW - mm(3), height: rowH - mm(1), lineBreak: false, ellipsis: true,
      })
    doc.font(FONT_NORMAL).fontSize(8)
      .text(value, margin + colLabelW + mm(1.5), y + mm(1.2), {
        width: colValueW - mm(3), height: rowH - mm(1), lineBreak: false, ellipsis: true,
      })
    y += rowH
  }
  doc.y = y
  doc.moveDown(0.3)
}

function parseSetupSection(content) {
  if (!content) return []
  const lines = content.trim().split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const raw = lines[i]
    const line = raw.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
    if (!line.trim()) { i++; continue }
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2] })
      i++; continue
    }
    if (/^\|.*\|$/.test(line.trim())) {
      const rows = []
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
        const l = lines[i].replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
        if (!/^\|[\s\-:|]+\|$/.test(l.trim())) {
          const cells = l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
          rows.push(cells)
        }
        i++
      }
      if (rows.length) blocks.push({ type: 'table', rows })
      continue
    }
    const listMatch = line.match(/^[\s]*[-*]\s+(.+)/)
    if (listMatch) {
      const items = []
      while (i < lines.length) {
        const l = lines[i].replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
        const m = l.match(/^[\s]*[-*]\s+(.+)/)
        if (!m) break
        items.push(m[1])
        i++
      }
      blocks.push({ type: 'list', items })
      continue
    }
    blocks.push({ type: 'text', text: line.trim() })
    i++
  }
  return blocks
}

function renderSetupBlocks(doc, blocks, margin, usableW) {
  for (const block of blocks) {
    if (block.type === 'heading') {
      if (block.level <= 2) {
        doc.moveDown(0.5)
        doc.font(FONT_BOLD).fontSize(11).text(block.text, margin, doc.y)
        doc.moveTo(margin, doc.y + 1).lineTo(margin + usableW, doc.y + 1).stroke('#cccccc')
        doc.moveDown(0.3)
      } else {
        doc.moveDown(0.3)
        doc.font(FONT_BOLD).fontSize(9).text(block.text, margin, doc.y)
        doc.moveDown(0.1)
      }
    } else if (block.type === 'text') {
      doc.font(FONT_NORMAL).fontSize(8.5).text(block.text, margin, doc.y, { width: usableW })
    } else if (block.type === 'list') {
      for (const item of block.items) {
        doc.font(FONT_NORMAL).fontSize(8.5)
          .text('•  ' + item, margin + mm(3), doc.y, { width: usableW - mm(3), lineGap: 1 })
      }
    } else if (block.type === 'table') {
      const rows = block.rows
      if (!rows.length) continue
      const colCount = Math.max(...rows.map(r => r.length))
      const col0W = mm(40)
      const colRest = (usableW - col0W) / Math.max(colCount - 1, 1)
      const rowH = mm(5.5)
      let y = doc.y
      for (let ri = 0; ri < rows.length; ri++) {
        const isHeader = ri === 0
        if (isHeader) {
          doc.rect(margin, y, usableW, rowH).fill('#e8e8e8')
          doc.fill('black')
        }
        doc.rect(margin, y, usableW, rowH).stroke('#cccccc')
        let x = margin
        for (let ci = 0; ci < rows[ri].length; ci++) {
          const w = ci === 0 ? col0W : colRest
          doc.font(isHeader ? FONT_BOLD : FONT_NORMAL).fontSize(8)
            .fill('black')
            .text(rows[ri][ci] || '', x + mm(1.5), y + mm(1.2), {
              width: w - mm(3), height: rowH - mm(1), lineBreak: false, ellipsis: true,
            })
          x += w
        }
        y += rowH
      }
      doc.y = y
      doc.moveDown(0.3)
    }
  }
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
