/**
 * Converts a template name to a display name.
 * Strips legacy .csv suffix and replaces hyphens with spaces.
 * Does NOT capitalize — names are stored and displayed as-is.
 */
export function templateDisplayName(filename: string | null | undefined): string {
  if (!filename) return ''
  return filename
    .replace(/\.csv$/i, '')
    .replace(/-/g, ' ')
}

