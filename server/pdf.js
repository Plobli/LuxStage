/**
 * pdf.js — Einleuchtplan PDF-Export
 * Layout entspricht dem bisherigen Word-Plan:
 * Kanäle nach Position gruppiert, mit Abschnitts-Überschriften
 */
import PDFDocument from 'pdfkit'

function parseSectionsMd(raw) {
  const map = new Map()
  const parts = raw.split(/^---section: [^\s]+---$/m)
  const ids = [...raw.matchAll(/^---section: ([^\s]+)---$/mg)].map(m => m[1])
  for (let i = 0; i < ids.length; i++) {
    map.set(ids[i], (parts[i + 1] ?? '').trim())
  }
  return map
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

// Lee-Farbpalette (Subset der häufigsten Filter)
const LEE_HEX = {
  'L001':'#f5c5a3','L002':'#f4a45a','L003':'#e8812a','L004':'#e05a1e','L005':'#c84010',
  'L006':'#b83010','L007':'#a02010','L008':'#881808','L009':'#701000','L010':'#f8e8d0',
  'L013':'#f0d0a0','L015':'#e8c080','L016':'#f0a030','L017':'#e08820','L019':'#c06010',
  'L020':'#a04010','L021':'#804020','L022':'#603020','L023':'#402010','L024':'#301810',
  'L025':'#f8f0e0','L026':'#f0e8c0','L027':'#e8d890','L028':'#e0c860','L029':'#d8b830',
  'L030':'#c8a010','L031':'#b89000','L032':'#a07800','L033':'#886000','L034':'#705000',
  'L035':'#584000','L036':'#403000','L037':'#302000','L038':'#201800','L039':'#181000',
  'L040':'#f8f8f0','L041':'#f0f0e0','L042':'#e8e8c8','L043':'#e0e0b0','L044':'#d8d898',
  'L045':'#d0d080','L046':'#c8c868','L047':'#c0c050','L048':'#b8b840','L049':'#b0b030',
  'L050':'#a0a020','L051':'#909010','L052':'#808000','L053':'#707000','L054':'#606000',
  'L055':'#505000','L056':'#404000','L057':'#303000','L058':'#202000','L059':'#181800',
  'L061':'#a0d0f0','L062':'#80c0e8','L063':'#60b0e0','L064':'#4098d0','L065':'#2080c0',
  'L068':'#1060a0','L069':'#0848808','L070':'#0830600','L071':'#062040','L072':'#041830',
  'L079':'#c8e8f8','L085':'#e0f0f8','L086':'#f0f8fc','L087':'#ffffff',
  'L100':'#f8f0f0','L101':'#f8d0d0','L102':'#f8b0b0','L103':'#f89090','L104':'#f87070',
  'L105':'#f85050','L106':'#f83030','L107':'#f81010','L108':'#e00000','L109':'#c00000',
  'L110':'#a00000','L111':'#800000','L113':'#600000','L114':'#400000','L115':'#200000',
  'L116':'#ffc0c0','L117':'#ff8080','L119':'#ff4040','L120':'#ff0000',
  'L121':'#f0e0f0','L122':'#e8c0e8','L123':'#e0a0e0','L124':'#d880d8','L125':'#d060d0',
  'L126':'#c040c0','L127':'#b020b0','L128':'#a000a0','L129':'#900090','L130':'#800080',
  'L131':'#700070','L132':'#600060','L133':'#500050','L134':'#400040','L135':'#300030',
  'L136':'#200020','L137':'#100010',
  'L138':'#e0e0f8','L139':'#c0c0f0','L140':'#a0a0e8','L141':'#8080e0','L142':'#6060d8',
  'L143':'#4040d0','L144':'#2020c8','L145':'#0000c0','L146':'#0000a0','L147':'#000080',
  'L148':'#000060','L149':'#000040','L150':'#000020',
  'L151':'#e8f8e8','L152':'#c0f0c0','L153':'#98e898','L154':'#70e070','L155':'#48d848',
  'L156':'#20d020','L157':'#00c800','L158':'#00a000','L159':'#008000','L160':'#006000',
  'L161':'#004000','L162':'#002000',
  'L170':'#fff8e0','L171':'#fff0c0','L172':'#ffe8a0','L173':'#ffe080','L174':'#ffd860',
  'L175':'#ffd040','L176':'#ffc820','L177':'#ffc000','L178':'#ffb800','L179':'#ffb000',
  'L180':'#ff9800','L181':'#ff8000','L182':'#ff6800','L183':'#ff5000','L184':'#ff3800',
  'L185':'#ff2000','L186':'#ff0808',
  'L190':'#f0f8ff','L191':'#e0f0ff','L192':'#c8e8ff','L193':'#b0e0ff','L194':'#98d8ff',
  'L195':'#80d0ff','L196':'#68c8ff','L197':'#50c0ff','L198':'#38b8ff','L199':'#20b0ff',
  'L200':'#a0d0f8','L201':'#a0d0f0','L202':'#80c8e8',
  'L203':'#d0e8f0','L204':'#b8d8e8','L205':'#a0c8e0','L206':'#88b8d8','L207':'#70a8d0',
  'L208':'#5898c8','L209':'#4088c0','L210':'#2878b8',
  'L281':'#e8f0e0','L282':'#d0e8c0','L283':'#b8e0a0','L284':'#a0d880','L285':'#88d060',
  'L286':'#70c840','L287':'#58c020','L288':'#40b800','L289':'#28a800','L290':'#109800',
}

function leeHex(code) {
  if (!code) return null
  const m = code.trim().toUpperCase().match(/L?(\d{3})/)
  if (!m) return null
  return LEE_HEX[`L${m[1]}`] ?? null
}

function contrastColor(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
  return (0.299*r + 0.587*g + 0.114*b)/255 > 0.5 ? '#000000' : '#ffffff'
}

export function generatePDF(showContent, channelsCsv, sectionsRaw, templateSections, res) {
  const fm = parseFrontmatter(showContent)
  const channels = parseCsv(channelsCsv)
  const grouped = groupByPosition(channels)

  const hasSections = Array.isArray(templateSections) && templateSections.length > 0
  const sectionContents = hasSections ? parseSectionsMd(sectionsRaw) : null
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
        { text: row.address, w: COL.address },
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
