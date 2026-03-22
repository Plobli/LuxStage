import filters from '../../../shared/filters.json'

// Build lookup: code → hex (Lee only)
const LEE_HEX = {}
for (const f of filters) {
  if (f.brand === 'Lee' && f.hex) {
    LEE_HEX[f.code] = f.hex
  }
}

/**
 * Given a color string (e.g. "L201", "201", "L201 / R02"),
 * returns the best-match hex color or null.
 */
export function leeColorHex(input) {
  if (!input) return null
  const upper = input.trim().toUpperCase()
  const match = upper.match(/L?\s*(\d{3})/)
  if (!match) return null
  return LEE_HEX[`L${match[1]}`] ?? null
}

/**
 * Returns inline style object for a filter badge, or null if no match.
 * Text color is auto-computed for contrast.
 */
export function filterBadgeStyle(input) {
  const hex = leeColorHex(input)
  if (!hex) return null
  return { backgroundColor: hex, color: contrastColor(hex) }
}

function contrastColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return l > 0.5 ? '#000000' : '#ffffff'
}

/** Vollständige Liste aller Lee-Filter mit Code, Name und Hex für Autocomplete (dedupliziert) */
export const LEE_FILTERS = Array.from(
  new Map(
    filters
      .filter(f => f.brand === 'Lee')
      .map(f => [f.code, { code: f.code, name: f.name, hex: f.hex || null }])
  ).values()
)
