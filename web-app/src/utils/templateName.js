/**
 * Converts a template filename to a display name.
 * e.g. "kammer-1.csv" → "Kammer 1"
 */
export function templateDisplayName(filename) {
  if (!filename) return ''
  return filename
    .replace(/\.csv$/i, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}
