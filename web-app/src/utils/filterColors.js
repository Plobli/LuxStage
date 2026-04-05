import filters from '../../../shared/filters.json'

// Build lookup: code → entry (all brands)
const BY_CODE = {}
for (const f of filters) {
  if (f.hex) BY_CODE[f.code] = f
}

/**
 * Normalizes user input to a filter code.
 * Handles: "201", "L201", "R44", "l201", "r44"
 */
function normalizeInput(input) {
  if (!input) return null
  const s = input.trim().toUpperCase()
  // Explicit brand prefix
  if (/^[LR]\d+$/.test(s)) {
    const brand = s[0]
    const num = s.slice(1).padStart(brand === 'L' ? 3 : 2, '0')
    return `${brand}${num}`
  }
  // Plain number — try Lee first, then Rosco
  const num = s.match(/^(\d+)$/)
  if (num) {
    const lee = `L${num[1].padStart(3, '0')}`
    if (BY_CODE[lee]) return lee
    const rosco = `R${num[1].padStart(2, '0')}`
    if (BY_CODE[rosco]) return rosco
  }
  return null
}

/**
 * Returns the hex color for a filter input, or null.
 */
export function filterColorHex(input) {
  const code = normalizeInput(input)
  return code ? (BY_CODE[code]?.hex ?? null) : null
}

/**
 * Returns inline style object for a filter badge, or null if no match.
 */
export function filterBadgeStyle(input) {
  const hex = filterColorHex(input)
  if (!hex) return null
  return { backgroundColor: hex, color: contrastColor(hex) }
}

function contrastColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return l > 0.5 ? '#000000' : '#ffffff'
}

/** Vollständige Liste aller Filter für Autocomplete */
export const ALL_FILTERS = Array.from(
  new Map(
    filters
      .filter(f => f.hex)
      .map(f => [f.code, { code: f.code, name: f.name, hex: f.hex }])
  ).values()
)
