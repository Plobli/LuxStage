/**
 * Einmalige Migration: Markdown-Strings → TipTap-JSON
 *
 * Konvertiert setup_markdown (shows) und content (section_contents, type=markdown)
 * von Plain-Markdown zu ProseMirror-JSON-Strings.
 *
 * Idempotent: Bereits konvertierte Einträge (beginnen mit '{') werden übersprungen.
 *
 * Aufruf: node server/migrate-to-tiptap.js
 */
import { dbContainer } from './db-init.js'

// ── Markdown → TipTap-JSON ────────────────────────────────────────────────────

function parseInline(text) {
  const nodes = []
  // Verarbeitet **bold**, *italic*, ***bold+italic***
  const re = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_)/g
  let last = 0
  let m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push({ type: 'text', text: text.slice(last, m.index) })
    if (m[2]) {
      nodes.push({ type: 'text', marks: [{ type: 'bold' }, { type: 'italic' }], text: m[2] })
    } else if (m[3]) {
      nodes.push({ type: 'text', marks: [{ type: 'bold' }], text: m[3] })
    } else if (m[4] || m[5]) {
      nodes.push({ type: 'text', marks: [{ type: 'italic' }], text: m[4] ?? m[5] })
    }
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push({ type: 'text', text: text.slice(last) })
  return nodes.length ? nodes : [{ type: 'text', text }]
}

function markdownToTiptap(md) {
  if (!md || !md.trim()) return { type: 'doc', content: [{ type: 'paragraph' }] }

  const lines = md.split('\n')
  const content = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Leerzeile
    if (!line.trim()) { i++; continue }

    // Heading ### oder ##
    if (line.startsWith('### ')) {
      content.push({ type: 'heading', attrs: { level: 3 }, content: parseInline(line.slice(4)) })
      i++; continue
    }
    if (line.startsWith('## ')) {
      content.push({ type: 'heading', attrs: { level: 2 }, content: parseInline(line.slice(3)) })
      i++; continue
    }
    if (line.startsWith('# ')) {
      content.push({ type: 'heading', attrs: { level: 1 }, content: parseInline(line.slice(2)) })
      i++; continue
    }

    // Bullet list (- oder *)
    if (/^[-*] /.test(line)) {
      const items = []
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        const text = lines[i].slice(2)
        items.push({ type: 'listItem', content: [{ type: 'paragraph', content: parseInline(text) }] })
        i++
      }
      content.push({ type: 'bulletList', content: items })
      continue
    }

    // Ordered list (1. 2. ...)
    if (/^\d+\. /.test(line)) {
      const items = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        const text = lines[i].replace(/^\d+\. /, '')
        items.push({ type: 'listItem', content: [{ type: 'paragraph', content: parseInline(text) }] })
        i++
      }
      content.push({ type: 'orderedList', attrs: { start: 1 }, content: items })
      continue
    }

    // GFM table
    if (line.includes('|')) {
      const tableLines = []
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i])
        i++
      }
      // Trennzeile (|---|---) herausfiltern
      const isDelim = l => /^\|[\s|:-]+\|$/.test(l.trim())
      const dataLines = tableLines.filter(l => !isDelim(l))
      if (dataLines.length) {
        const rows = dataLines.map((l, ri) => {
          const cells = l.split('|').map(s => s.trim()).filter((s, ci) => ci > 0 && ci < l.split('|').length - 1)
          return {
            type: 'tableRow',
            content: cells.map(cell => ({
              type: ri === 0 ? 'tableHeader' : 'tableCell',
              attrs: { colspan: 1, rowspan: 1, colwidth: null },
              content: [{ type: 'paragraph', content: parseInline(cell) }],
            })),
          }
        })
        content.push({ type: 'table', content: rows })
      }
      continue
    }

    // Paragraph (mehrzeilig bis Leerzeile)
    const paraLines = []
    while (i < lines.length && lines[i].trim() && !/^[#\-*\d]/.test(lines[i]) && !lines[i].includes('|')) {
      paraLines.push(lines[i])
      i++
    }
    if (paraLines.length) {
      content.push({ type: 'paragraph', content: parseInline(paraLines.join(' ')) })
    }
  }

  if (!content.length) content.push({ type: 'paragraph' })
  return { type: 'doc', content }
}

// ── Migration ─────────────────────────────────────────────────────────────────

function isAlreadyJson(str) {
  return typeof str === 'string' && str.trim().startsWith('{')
}

function run() {
  const db = dbContainer.db
  let convertedSetup = 0
  let convertedSections = 0
  let skipped = 0

  // setup_markdown in shows
  const shows = db.prepare(`SELECT id, setup_markdown FROM shows WHERE setup_markdown IS NOT NULL AND setup_markdown != ''`).all()
  const updateSetup = db.prepare('UPDATE shows SET setup_markdown = ? WHERE id = ?')

  for (const show of shows) {
    if (isAlreadyJson(show.setup_markdown)) { skipped++; continue }
    const json = JSON.stringify(markdownToTiptap(show.setup_markdown))
    updateSetup.run(json, show.id)
    convertedSetup++
  }

  // section_contents — nur type=markdown Sections
  const sections = db.prepare(`
    SELECT sc.section_id, sc.show_id, sc.content, sd.type
    FROM section_contents sc
    JOIN section_defs sd ON sd.id = sc.section_id
    WHERE sd.type = 'markdown' AND sc.content IS NOT NULL AND sc.content != ''

  `).all()
  const updateSection = db.prepare('UPDATE section_contents SET content = ? WHERE section_id = ? AND show_id = ?')

  for (const sec of sections) {
    if (isAlreadyJson(sec.content)) { skipped++; continue }
    const json = JSON.stringify(markdownToTiptap(sec.content))
    updateSection.run(json, sec.section_id, sec.show_id)
    convertedSections++
  }

  console.log(`✓ setup_markdown konvertiert: ${convertedSetup}`)
  console.log(`✓ section_contents konvertiert: ${convertedSections}`)
  console.log(`  übersprungen (bereits JSON): ${skipped}`)
  dbContainer.db.close()
  process.exit(0)
}

run()
