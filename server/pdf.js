/**
 * pdf.js — Einleuchtplan PDF-Export
 * Layout entspricht dem bisherigen Word-Plan:
 * Kanäle nach Position gruppiert, mit Abschnitts-Überschriften
 */
import PDFDocument from 'pdfkit'
import { parseSectionsMd } from './io.js'

// Spaltenbreiten (mm → pt: 1mm ≈ 2.835pt)
const mm = (v) => v * 2.835
const PAGE_MARGIN = mm(15)
const COL = {
  channel:  mm(12),
  device:   mm(38),
  color:    mm(20),
  address:  mm(16),
  notes:    0, // Rest (gesamte verbleibende Breite)
}
const ROW_H = mm(6)
const HEADER_H = mm(8)
const FONT_NORMAL = 'Helvetica'
const FONT_BOLD   = 'Helvetica-Bold'

export function generatePDF(showContent, channelsCsv, sectionsRaw, templateSections, res) {
  const fm = parseFrontmatter(showContent)
  const channels = parseCsv(channelsCsv)
  const grouped = groupByPosition(channels)

  // Sections: entweder aus sections.md + Template, oder Fallback auf alte show.md
  const hasSections = Array.isArray(templateSections) && templateSections.length > 0
  const sectionContents = hasSections ? parseSectionsMd(sectionsRaw) : null
  const sortedSections = hasSections
    ? [...templateSections].sort((a, b) => a.order - b.order)
    : null

  const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: PAGE_MARGIN })
  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="einleuchtplan-${fm.name || 'show'}.pdf"`,
  })
  doc.pipe(res)

  const pageW = doc.page.width
  const usableW = pageW - PAGE_MARGIN * 2
  COL.notes = usableW - Object.values(COL).reduce((a, b) => a + b, 0)

  // ── Titel ────────────────────────────────────────────────────────────────
  doc.font(FONT_BOLD).fontSize(16)
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
    // Fallback: alter Aufbau-Block aus show.md
    const setupBlocks = parseSetupSection(showContent.replace(/^---\n[\s\S]*?\n---\n/, ''))
    if (setupBlocks.length) {
      doc.font(FONT_BOLD).fontSize(11).text('Aufbau', PAGE_MARGIN, doc.y)
      doc.moveDown(0.5)
      renderSetupBlocks(doc, setupBlocks, PAGE_MARGIN, usableW)
      doc.moveDown(1.5)
    }
  }

  // ── Pro Gruppe: Überschrift + Tabelle ────────────────────────────────────
  let y = doc.y
  for (const [position, rows] of grouped) {
    const filteredRows = rows.filter(r => r.notes?.trim())
    if (!filteredRows.length) continue
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
    const headerCols = [
      { text: 'Ch', w: COL.channel },
      { text: 'Gerät', w: COL.device },
      { text: 'Filter', w: COL.color },
      { text: 'Adresse', w: COL.address },
      { text: 'Notizen', w: COL.notes },
    ]
    y = drawRow(doc, y, usableW, headerCols, true)

    // Datenzeilen — nur Kanäle mit Notizen
    for (const row of filteredRows) {
      const rowCols = [
        { text: row.channel, w: COL.channel },
        { text: row.device,  w: COL.device },
        { text: row.color,   w: COL.color },
        { text: row.address, w: COL.address },
        { text: row.notes,   w: COL.notes, wrap: true },
      ]
      const rowH = calcRowHeight(doc, rowCols)
      if (y + rowH > doc.page.height - PAGE_MARGIN) {
        doc.addPage()
        y = PAGE_MARGIN
        // Gruppen-Header wiederholen
        doc.rect(PAGE_MARGIN, y, usableW, HEADER_H).fill('#555')
        doc.fill('white').font(FONT_BOLD).fontSize(8)
          .text(`${position} (Forts.)`, PAGE_MARGIN + mm(2), y + mm(2))
        doc.fill('black')
        y += HEADER_H
        y = drawRow(doc, y, usableW, headerCols, true)
      }
      y = drawRow(doc, y, usableW, rowCols, false)
    }
    y += mm(3) // Abstand nach Gruppe
  }

  doc.end()
}

// ── Helpers ────────────────────────────────────────────────────────────────

function calcRowHeight(doc, cols) {
  doc.font(FONT_NORMAL).fontSize(8)
  let maxH = ROW_H
  for (const col of cols) {
    if (!col.wrap || !col.text) continue
    const h = doc.heightOfString(col.text, { width: col.w - mm(2) }) + mm(2.6)
    if (h > maxH) maxH = h
  }
  return maxH
}

function drawRow(doc, y, usableW, cols, isHeader) {
  const rowH = isHeader ? ROW_H : calcRowHeight(doc, cols)
  if (isHeader) {
    doc.rect(PAGE_MARGIN, y, usableW, rowH).fill('#e8e8e8')
    doc.fill('black')
  }
  doc.rect(PAGE_MARGIN, y, usableW, rowH).stroke('#cccccc')

  let x = PAGE_MARGIN
  for (const col of cols) {
    doc.font(isHeader ? FONT_BOLD : FONT_NORMAL).fontSize(isHeader ? 7.5 : 8)
      .text(col.text || '', x + mm(1), y + mm(1.3), {
        width: col.w - mm(2),
        lineBreak: col.wrap === true,
        ellipsis: !col.wrap,
      })
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
    const re = new RegExp(`^${field.key}:\\s*(.*)$`, 'm')
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

// Gibt strukturierte Blöcke zurück: { type: 'heading'|'table'|'list'|'text', ... }
function parseSetupSection(content) {
  if (!content) return []
  const lines = content.trim().split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const raw = lines[i]
    const line = raw.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
    // Leerzeile
    if (!line.trim()) { i++; continue }
    // Überschrift
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2] })
      i++; continue
    }
    // Tabelle: sammle alle aufeinanderfolgenden Tabellenzeilen
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
    // Liste
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
      // Erste Spalte breiter (Label), Rest gleich verteilt
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
