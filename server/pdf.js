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
// floorplan: { imagePath, canvasData } — optionaler Grundriss
export async function generatePDF(show, channels, sectionsMap, templateSections, photoEntries, res, floorplan = null) {
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
    const curPageH = doc.page.height
    const curPageW = doc.page.width
    const curUsableW = curPageW - PAGE_MARGIN * 2
    const fy = curPageH - PAGE_MARGIN - mm(4)
    // doc.y temporär weit oben setzen damit pdfkit kein continueOnNewPage auslöst
    const savedY = doc.y
    doc.y = PAGE_MARGIN
    doc.font(FONT_NORMAL).fontSize(7).fillColor('#888888')
      .text(`${fm.name || ''} — ${fmt(fm.datum)}`, PAGE_MARGIN, fy, { width: curUsableW / 2, lineBreak: false })
    doc.text(`Seite ${pageNum}  |  ${printedAt}`, PAGE_MARGIN + curUsableW / 2, fy, {
      width: curUsableW / 2, align: 'right', lineBreak: false
    })
    doc.fillColor('black')
    doc.y = savedY
  }
  addFooter()

  // ── Titel ────────────────────────────────────────────────────────────────
  doc.font(FONT_BOLD).fontSize(16).fillColor('black')
    .text(`Einleuchtplan — ${fm.name || ''}`, PAGE_MARGIN, PAGE_MARGIN)
  doc.font(FONT_NORMAL).fontSize(10)
    .text(fm.venue ? `${fm.venue}   |   ${fmt(fm.datum)}` : fmt(fm.datum), PAGE_MARGIN, PAGE_MARGIN + mm(8))
  doc.moveDown(1.5)

  // ── Sections ─────────────────────────────────────────────────────────────
  if (hasSections) {
    for (const sec of sortedSections) {
      const content = sectionContents.get(sec.id) ?? ''
      const hasContent = sec.type === 'kv-table'
        ? (sec.rows ?? []).some(r => r.value?.trim())
        : parseSetupSection(content).length > 0
      if (!hasContent) continue
      doc.font(FONT_BOLD).fontSize(11).text(sec.title, PAGE_MARGIN, doc.y)
      doc.moveDown(0.4)
      if (sec.type === 'kv-table') {
        renderKvTableSection(doc, sec.rows ?? [], PAGE_MARGIN, usableW)
      } else if (sec.type === 'fields') {
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
      addFooter()
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
        addFooter()
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
      await new Promise(resolve => setImmediate(resolve))
    }
    y += mm(3)
  }

  // ── Foto-Abschnitt ────────────────────────────────────────────────────────
  const validPhotos = (photoEntries ?? []).filter(e => {
    try { fs.accessSync(e.path); return true } catch { return false }
  })

  if (validPhotos.length > 0) {
    doc.addPage()
    addFooter()
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
        addFooter()
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

  // ── Grundriss ─────────────────────────────────────────────────────────────
  if (floorplan?.snapshotPath) {
    let snapshotBuffer = null
    try { snapshotBuffer = fs.readFileSync(floorplan.snapshotPath) } catch {}
    if (snapshotBuffer && snapshotBuffer.length > 100) {
      doc.addPage()
      addFooter()

      doc.font(FONT_BOLD).fontSize(13).fillColor('black')
        .text('Grundriss', PAGE_MARGIN, PAGE_MARGIN, { lineBreak: false })

      const imgY = PAGE_MARGIN + mm(12)
      const imgMaxH = pageH - imgY - PAGE_MARGIN - mm(8)

      try {
        doc.image(snapshotBuffer, PAGE_MARGIN, imgY, {
          fit: [usableW, imgMaxH],
          align: 'center',
          valign: 'top',
        })
        doc.y = PAGE_MARGIN
      } catch {
        doc.font(FONT_NORMAL).fontSize(9).fillColor('#888888')
          .text('Grundriss konnte nicht geladen werden.', PAGE_MARGIN, imgY)
      }
    }
  }

  // ── Gassentürme & Zugstangen ──────────────────────────────────────────────
  const towers = floorplan?.towers ?? []
  const bars = floorplan?.bars ?? []

  if (towers.length > 0 || bars.length > 0) {
    doc.addPage()
    addFooter()
    let ty = PAGE_MARGIN

    if (towers.length > 0) {
      doc.font(FONT_BOLD).fontSize(13).fillColor('black').text('Gassentürme', PAGE_MARGIN, ty, { lineBreak: false })
      ty += mm(9)
      ty = drawTowerCards(doc, towers, channels, PAGE_MARGIN, usableW, ty, printableBottom, addFooter)
      ty += mm(8)
    }

    if (bars.length > 0) {
      if (ty + mm(30) > printableBottom) { doc.addPage(); addFooter(); ty = PAGE_MARGIN }
      doc.font(FONT_BOLD).fontSize(13).fillColor('black').text('Hängerei', PAGE_MARGIN, ty, { lineBreak: false })
      ty += mm(9)
      ty = renderHangereiBars(doc, bars, channels, PAGE_MARGIN, usableW, ty, printableBottom, addFooter)
      ty += mm(8)

      if (ty + mm(20) > printableBottom) { doc.addPage(); addFooter(); ty = PAGE_MARGIN }
      doc.font(FONT_BOLD).fontSize(13).fillColor('black').text('Zugstangen', PAGE_MARGIN, ty, { lineBreak: false })
      ty += mm(9)
      drawBarRows(doc, bars, channels, PAGE_MARGIN, usableW, ty, printableBottom, addFooter)
    }
  }

  doc.end()
}

// ── Helpers ────────────────────────────────────────────────────────────────

const MAX_ROW_H = mm(40) // Sicherheitsgrenze gegen pdfkit Stack Overflow

function calcRowHeight(doc, cols) {
  doc.font(FONT_NORMAL).fontSize(8)
  let maxH = ROW_MIN_H
  for (const col of cols) {
    if (!col.wrap || !col.text) continue
    const w = col.w - mm(2)
    if (w <= 0) continue
    const h = doc.heightOfString(col.text, { width: w }) + mm(2.6)
    if (h > maxH) maxH = h
  }
  return Math.min(maxH, MAX_ROW_H)
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

function renderKvTableSection(doc, rows, margin, usableW) {
  const colLabelW = mm(45)
  const colValueW = usableW - colLabelW
  const rowH = mm(5.5)
  let y = doc.y
  for (const row of rows) {
    const value = row.value?.trim() ?? ''
    if (!value) continue
    doc.rect(margin, y, usableW, rowH).stroke('#cccccc')
    doc.font(FONT_BOLD).fontSize(8)
      .text(row.label ?? '', margin + mm(1.5), y + mm(1.2), {
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

function tiptapNodeText(node) {
  if (!node) return ''
  if (node.type === 'text') return node.text ?? ''
  if (Array.isArray(node.content)) return node.content.map(tiptapNodeText).join('')
  return ''
}

function parseTiptapDoc(doc) {
  const blocks = []
  if (!doc?.content) return blocks
  for (const node of doc.content) {
    if (node.type === 'heading') {
      blocks.push({ type: 'heading', level: node.attrs?.level ?? 1, text: tiptapNodeText(node) })
    } else if (node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'taskList') {
      const items = (node.content ?? []).map(li => tiptapNodeText(li).trim()).filter(Boolean)
      if (items.length) blocks.push({ type: 'list', items })
    } else if (node.type === 'table') {
      const rows = []
      for (const tr of (node.content ?? [])) {
        const cells = (tr.content ?? []).map(td => tiptapNodeText(td).trim())
        rows.push(cells)
      }
      if (rows.length) blocks.push({ type: 'table', rows })
    } else if (node.type === 'paragraph') {
      const text = tiptapNodeText(node).trim()
      if (text) blocks.push({ type: 'text', text })
    }
  }
  return blocks
}

function parseSetupSection(content) {
  if (!content) return []
  const trimmed = content.trim()
  if (trimmed.startsWith('{')) {
    try {
      const doc = JSON.parse(trimmed)
      return parseTiptapDoc(doc)
    } catch {}
  }
  const lines = trimmed.split('\n')
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
        doc.font(FONT_BOLD).fontSize(11).text(block.text, margin, doc.y, { width: usableW, lineBreak: true })
        doc.moveTo(margin, doc.y + 1).lineTo(margin + usableW, doc.y + 1).stroke('#cccccc')
        doc.moveDown(0.3)
      } else {
        doc.moveDown(0.3)
        doc.font(FONT_BOLD).fontSize(9).text(block.text, margin, doc.y, { width: usableW, lineBreak: true })
        doc.moveDown(0.1)
      }
    } else if (block.type === 'text') {
      doc.font(FONT_NORMAL).fontSize(8.5).text(block.text, margin, doc.y, { width: usableW, lineBreak: true })
    } else if (block.type === 'list') {
      for (const item of block.items) {
        doc.font(FONT_NORMAL).fontSize(8.5)
          .text('•  ' + item, margin + mm(3), doc.y, { width: usableW - mm(3), lineGap: 1, lineBreak: true })
      }
    } else if (block.type === 'table') {
      const rows = block.rows
      if (!rows.length) continue
      const colCount = Math.max(...rows.map(r => r.length))
      const col0W = mm(40)
      const colRest = (usableW - col0W) / Math.max(colCount - 1, 1)
      let y = doc.y
      for (let ri = 0; ri < rows.length; ri++) {
        const isHeader = ri === 0
        const font = isHeader ? FONT_BOLD : FONT_NORMAL
        // Berechne Zeilenhöhe anhand des längsten Zellinhalts
        let rowH = mm(5.5)
        for (let ci = 0; ci < rows[ri].length; ci++) {
          const w = ci === 0 ? col0W : colRest
          const cellText = rows[ri][ci] || ''
          if (!cellText) continue
          const h = doc.font(font).fontSize(8).heightOfString(cellText, { width: w - mm(3) }) + mm(2.4)
          if (h > rowH) rowH = h
        }
        if (isHeader) {
          doc.rect(margin, y, usableW, rowH).fill('#e8e8e8')
          doc.fill('black')
        }
        doc.rect(margin, y, usableW, rowH).stroke('#cccccc')
        let x = margin
        for (let ci = 0; ci < rows[ri].length; ci++) {
          const w = ci === 0 ? col0W : colRest
          doc.font(font).fontSize(8)
            .fill('black')
            .text(rows[ri][ci] || '', x + mm(1.5), y + mm(1.2), {
              width: w - mm(3), lineBreak: true,
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

// Gassentürme als Karten-Grid (3 Spalten), Slots vertikal von oben nach unten
function drawTowerCards(doc, towers, channels, margin, usableW, startY, bottomLimit, addFooter) {
  const COLS = 3
  const GAP = mm(4)
  const cardW = (usableW - GAP * (COLS - 1)) / COLS
  const CARD_PAD = mm(3)
  const CARD_HEADER_H = mm(10)
  const SLOT_H = mm(6.5)
  const CIRCLE_R = mm(2.8)

  // Kartenhöhe berechnen
  function cardHeight(tower) {
    const slotCount = (tower.slots ?? []).length
    return CARD_HEADER_H + slotCount * SLOT_H + mm(2)
  }

  let col = 0
  let rowY = startY
  // Höhe der aktuellen Reihe = Maximum der Karten in dieser Reihe
  let rowCards = []

  function flushRow() {
    if (rowCards.length === 0) return
    const maxH = Math.max(...rowCards.map(c => c.h))
    rowY += maxH + GAP
    rowCards = []
    col = 0
  }

  for (const tower of towers) {
    const cardH = cardHeight(tower)

    if (col === 0 && rowY + cardH > bottomLimit) {
      doc.addPage(); addFooter(); rowY = PAGE_MARGIN
    }

    const cx = margin + col * (cardW + GAP)

    // Karten-Rahmen
    doc.roundedRect(cx, rowY, cardW, cardH, 4).fillAndStroke('#f8f8f8', '#dddddd')
    doc.fillColor('black')

    // Header-Hintergrund
    doc.roundedRect(cx, rowY, cardW, CARD_HEADER_H, 4).fill('#eeeeee')
    // untere Ecken gerade machen
    doc.rect(cx, rowY + CARD_HEADER_H - 4, cardW, 4).fill('#eeeeee')
    doc.fillColor('black')

    // Name
    doc.font(FONT_BOLD).fontSize(9).fillColor('#111111')
      .text(tower.name ?? '', cx + CARD_PAD, rowY + mm(2), { width: cardW - CARD_PAD * 2 - mm(12), lineBreak: false, ellipsis: true })

    // Slot-Count oben rechts in Rot
    const filledSlots = (tower.slots ?? []).filter(s => s.channel_id)
    const slotLabel = `${filledSlots.length}/${tower.slot_count ?? tower.slots?.length ?? 0}`
    doc.font(FONT_BOLD).fontSize(7).fillColor('#dc3740')
      .text(slotLabel, cx + cardW - CARD_PAD - mm(12), rowY + mm(2), { width: mm(12), align: 'right', lineBreak: false })

    // Bereich · Seite
    const meta = [tower.stage_area, tower.side].filter(Boolean).join(' · ')
    if (meta) {
      doc.font(FONT_NORMAL).fontSize(6.5).fillColor('#888888')
        .text(meta, cx + CARD_PAD, rowY + mm(6), { width: cardW - CARD_PAD * 2, lineBreak: false, ellipsis: true })
    }

    // Slots vertikal
    const allSlots = [...(tower.slots ?? [])].sort((a, b) => a.slot_index - b.slot_index)
    let sy = rowY + CARD_HEADER_H
    for (const slot of allSlots) {
      const ch = slot.channel_id ? channels.find(c => c.id === slot.channel_id) : null

      // Slot-Trennlinie
      doc.moveTo(cx + mm(1), sy).lineTo(cx + cardW - mm(1), sy).lineWidth(0.3).stroke('#dddddd').lineWidth(1)

      // Slot-Index
      doc.font(FONT_NORMAL).fontSize(6).fillColor('#aaaaaa')
        .text(String(slot.slot_index), cx + mm(2), sy + (SLOT_H - mm(2.5)) / 2, { width: mm(4), align: 'right', lineBreak: false })

      if (ch) {
        // Kanal-Kreis
        const circleCx = cx + mm(9)
        const circleCy = sy + SLOT_H / 2
        doc.circle(circleCx, circleCy, CIRCLE_R).fill('#dc3740')
        const textH = doc.font(FONT_BOLD).fontSize(6).currentLineHeight()
        doc.fillColor('white').text(String(ch.channel), circleCx - CIRCLE_R, circleCy - textH / 2, { width: CIRCLE_R * 2, align: 'center', lineBreak: false })
        doc.fillColor('black')

        // Farbcode-Badge
        if (ch.color) {
          const hex = leeHex(ch.color)
          const badgeX = cx + mm(14)
          const badgeW = mm(12)
          const badgeH = mm(4)
          const badgeY = sy + (SLOT_H - badgeH) / 2
          if (hex) {
            doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2).fill(hex)
            const contrast = contrastColor(hex)
            doc.font(FONT_BOLD).fontSize(5.5).fillColor(contrast)
              .text(ch.color, badgeX, badgeY + mm(0.8), { width: badgeW, align: 'center', lineBreak: false })
          } else {
            doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2).fillAndStroke('#eeeeee', '#cccccc')
            doc.font(FONT_NORMAL).fontSize(5.5).fillColor('#555555')
              .text(ch.color, badgeX, badgeY + mm(0.8), { width: badgeW, align: 'center', lineBreak: false })
          }
          doc.fillColor('black')
        }

        // Gerätename
        const deviceX = cx + mm(28)
        const deviceW = cardW - mm(28) - CARD_PAD
        if (ch.device && deviceW > mm(5)) {
          doc.font(FONT_NORMAL).fontSize(6.5).fillColor('#333333')
            .text(ch.device, deviceX, sy + (SLOT_H - mm(2.5)) / 2, { width: deviceW, lineBreak: false, ellipsis: true })
        }
      } else {
        doc.font(FONT_NORMAL).fontSize(6.5).fillColor('#cccccc')
          .text('—', cx + mm(9), sy + (SLOT_H - mm(2.5)) / 2, { width: cardW - mm(12), lineBreak: false })
      }

      sy += SLOT_H
    }

    rowCards.push({ h: cardH })
    col++
    if (col >= COLS) flushRow()
  }
  flushRow()
  return rowY
}

// Hängerei als Textliste (eine Zeile pro Zug)
function renderHangereiBars(doc, bars, channels, margin, usableW, startY, bottomLimit, addFooter) {
  const LINE_H = mm(5.5)
  let ty = startY

  function fmtColor(color) {
    if (!color) return undefined
    const s = color.trim()
    if (/^[LRlr]\d/.test(s)) return s.toUpperCase()
    if (/^\d/.test(s)) return `L${s}`
    return s
  }

  const sorted = [...bars].sort((a, b) => a.sort_order - b.sort_order)
  for (const bar of sorted) {
    const fixtures = bar.fixtures ?? []
    if (!fixtures.length && !bar.notes) continue
    if (!fixtures.length) {
      const lineH = doc.font(FONT_NORMAL).fontSize(8.5).heightOfString(bar.notes, { width: usableW }) + mm(1)
      if (ty + lineH > bottomLimit) { doc.addPage(); addFooter(); ty = PAGE_MARGIN }
      const nameLabel = `${bar.name}: `
      doc.font(FONT_BOLD).fontSize(8.5).fillColor('black')
        .text(nameLabel, margin, ty, { continued: true, lineBreak: false })
      doc.font(FONT_NORMAL).text(bar.notes, { width: usableW - doc.widthOfString(nameLabel), lineBreak: true })
      ty += lineH + mm(1)
      continue
    }

    const fixSorted = [...fixtures].sort((a, b) => a.position - b.position)
    const parts = fixSorted.map(fx => {
      const ch = channels.find(c => c.id === fx.channel_id)
      const tokens = [`V.${ch?.channel ?? '?'}`, ch?.device, ch?.address ? `#${ch.address}` : undefined, fmtColor(ch?.color), fx.notes || undefined]
      // Position in m
      const cm = fx.position
      let posStr
      if (cm === 0) posStr = 'Mitte'
      else {
        const val = Math.abs(cm) / 100
        const valStr = Number.isInteger(val) ? val : parseFloat(val.toFixed(2))
        posStr = `${valStr}m ${cm < 0 ? 'Links' : 'Rechts'}`
      }
      tokens.push(posStr)
      return tokens.filter(Boolean).join(' ')
    })
    let line = `${bar.name}: ${parts.join(' • ')}`
    if (bar.notes) line += ` • ${bar.notes}`

    // Seitenumbruch
    const lineH = doc.font(FONT_NORMAL).fontSize(8.5).heightOfString(line, { width: usableW }) + mm(1)
    if (ty + lineH > bottomLimit) { doc.addPage(); addFooter(); ty = PAGE_MARGIN }

    const nameLabel = `${bar.name}: `
    doc.font(FONT_BOLD).fontSize(8.5).fillColor('black')
      .text(nameLabel, margin, ty, { continued: true, lineBreak: false })
    const rest = line.slice(nameLabel.length)
    doc.font(FONT_NORMAL)
      .text(rest, { width: usableW - doc.widthOfString(nameLabel), lineBreak: true })
    ty += lineH + mm(1)
  }
  return ty
}

// Zugstangen als visuelle Zeilen mit Kanal-Kreisen
function drawBarRows(doc, bars, channels, margin, usableW, startY, bottomLimit, addFooter) {
  const BAR_H = mm(26)
  const CIRCLE_R = mm(3.5)
  const GAP = mm(3)

  let ty = startY
  for (const bar of bars) {
    if (ty + BAR_H > bottomLimit) { doc.addPage(); addFooter(); ty = PAGE_MARGIN }

    // Hintergrund
    doc.roundedRect(margin, ty, usableW, BAR_H, 3).fillAndStroke('#f8f8f8', '#dddddd')
    doc.fillColor('black')

    // Name links
    doc.font(FONT_BOLD).fontSize(9).fillColor('#111111')
      .text(bar.name ?? '', margin + mm(3), ty + mm(2), { width: mm(40), lineBreak: false, ellipsis: true })

    // Meta: Länge + Zug
    const meta = [bar.length_cm ? `${bar.length_cm} cm` : null, bar.zug_nr ? `Zug ${bar.zug_nr}` : null].filter(Boolean).join(' · ')
    doc.font(FONT_NORMAL).fontSize(7).fillColor('#888888')
      .text(meta, margin + mm(3), ty + mm(7), { width: mm(40), lineBreak: false })

    // Stangen-Linie — etwas oberhalb der Mitte für Positionstext darunter
    const lineLeft = margin + mm(47)
    const lineRight = margin + usableW - mm(3)
    const lineY = ty + mm(13)
    doc.moveTo(lineLeft, lineY).lineTo(lineRight, lineY).lineWidth(2).stroke('#10b981').lineWidth(1)

    // Endmarkierungen
    doc.moveTo(lineLeft, lineY - mm(2)).lineTo(lineLeft, lineY + mm(2)).lineWidth(1).stroke('#10b981')
    doc.moveTo(lineRight, lineY - mm(2)).lineTo(lineRight, lineY + mm(2)).lineWidth(1).stroke('#10b981')

    // Fixture-Circles mit Positions-Label darunter
    const fixtures = bar.fixtures ?? []
    const barLenCm = bar.length_cm || 600
    const linePx = lineRight - lineLeft
    for (const fx of fixtures) {
      const posFrac = (fx.position + barLenCm / 2) / barLenCm
      const cx = lineLeft + posFrac * linePx
      const ch = channels.find(c => c.id === fx.channel_id)
      const nr = ch?.channel ?? '?'

      // Kreis
      doc.circle(cx, lineY, CIRCLE_R).fill('#dc3740')
      const textH = doc.font(FONT_BOLD).fontSize(6.5).currentLineHeight()
      doc.fillColor('white').text(String(nr), cx - CIRCLE_R, lineY - textH / 2, { width: CIRCLE_R * 2, align: 'center', lineBreak: false })
      doc.fillColor('black')

      // Positionswert darunter (cm von Mitte, positiv = RS, negativ = LKS)
      const posLabel = fx.position === 0 ? '0' : (fx.position > 0 ? `+${fx.position}` : String(fx.position))
      doc.font(FONT_NORMAL).fontSize(5.5).fillColor('#666666')
        .text(posLabel, cx - mm(5), lineY + CIRCLE_R + mm(1), { width: mm(10), align: 'center', lineBreak: false })
    }

    ty += BAR_H + GAP
  }
  return ty
}

function drawGenericRow(doc, y, usableW, cells, colWidths, isHeader) {
  const rowH = ROW_MIN_H
  if (isHeader) {
    doc.rect(PAGE_MARGIN, y, usableW, rowH).fill('#f4f4f4')
    doc.fill('black')
  }
  doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + usableW, y).stroke('#dddddd')
  doc.moveTo(PAGE_MARGIN, y + rowH).lineTo(PAGE_MARGIN + usableW, y + rowH).stroke('#dddddd')
  let x = PAGE_MARGIN
  for (let i = 0; i < cells.length; i++) {
    const w = colWidths[i]
    const textH = doc.font(isHeader ? FONT_BOLD : FONT_NORMAL).fontSize(8).currentLineHeight()
    const textY = y + (rowH - textH) / 2
    doc.fillColor(isHeader ? '#666666' : 'black')
      .text(String(cells[i] ?? ''), x + mm(1.5), textY, { width: w - mm(3), lineBreak: false, ellipsis: true })
    x += w
  }
  doc.fillColor('black')
  return y + rowH
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
