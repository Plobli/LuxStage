/**
 * CSV parser for LuxStage venue templates.
 * Format: see docs/venue-template-format.md
 */

export function parseTemplateCSV(text) {
  const errors = []
  const result = {
    venue_name: '',
    venue_hall: '',
    custom_fields: [],   // [{ field_name, unit_hint, position }]
    channels: [],        // [{ channel_number, universe, dmx_address, device, color, description, category, position }]
    errors,
  }

  // Strip UTF-8 BOM if present
  const content = text.startsWith('\uFEFF') ? text.slice(1) : text

  const lines = content.split(/\r?\n/)
  let section = 1 // 1 = metadata, 2 = channel table
  let headerMap = null // column name → index
  let channelPosition = 1

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()
    const lineNum = i + 1

    // Skip comments and blank lines
    if (line === '' || line.startsWith('#')) continue

    // Section separator
    if (line === '---') {
      section = 2
      continue
    }

    if (section === 1) {
      // Metadata lines: key;value or key;value;hint
      const parts = line.split(';')
      const key = parts[0].trim().toLowerCase()

      if (key === 'venue_name') {
        result.venue_name = parts[1]?.trim() ?? ''
      } else if (key === 'venue_hall') {
        result.venue_hall = parts[1]?.trim() ?? ''
      } else if (key === 'show_field') {
        const field_name = parts[1]?.trim() ?? ''
        const unit_hint = parts[2]?.trim() ?? ''
        if (field_name) {
          result.custom_fields.push({
            field_name,
            unit_hint,
            position: result.custom_fields.length + 1,
          })
        }
      }
      // Unknown keys in section 1 are silently ignored
    } else {
      // Section 2: channel table
      if (headerMap === null) {
        // First non-comment line after --- is the header row
        headerMap = {}
        line.split(';').forEach((col, idx) => {
          headerMap[col.trim().toLowerCase()] = idx
        })

        if (!('channel_number' in headerMap)) {
          errors.push({ key: 'csv.error.missing_header', params: { column: 'channel_number' } })
          break
        }
        continue
      }

      const cols = line.split(';')
      const get = (name) => cols[headerMap[name]]?.trim() ?? ''

      const rawChannel = get('channel_number')
      if (!rawChannel) continue // skip blank channel_number

      if (!/^\d+$/.test(rawChannel)) {
        errors.push({ key: 'csv.error.invalid_channel', params: { line: lineNum, value: rawChannel } })
        continue
      }

      // Parse address "1/001" → universe + dmx_address
      let universe = null
      let dmx_address = null
      const rawAddress = 'address' in headerMap ? get('address') : ''
      if (rawAddress) {
        const match = rawAddress.match(/^(\d+)\/(\d+)$/)
        if (match) {
          universe = parseInt(match[1], 10)
          dmx_address = parseInt(match[2], 10)
        } else {
          errors.push({ key: 'csv.error.invalid_address', params: { line: lineNum, value: rawAddress } })
          continue
        }
      }

      result.channels.push({
        channel_number: rawChannel,
        universe,
        dmx_address,
        device: 'device' in headerMap ? get('device') : '',
        color: 'color' in headerMap ? get('color') : '',
        description: 'description' in headerMap ? get('description') : '',
        category: 'category' in headerMap ? get('category') : '',
        position: channelPosition++,
      })
    }
  }

  // Check for duplicate channel numbers
  const seen = new Set()
  for (const ch of result.channels) {
    if (seen.has(ch.channel_number)) {
      errors.push({ key: 'csv.error.duplicate_channel', params: { channel: ch.channel_number } })
    }
    seen.add(ch.channel_number)
  }

  return result
}

/**
 * Format address for display: universe=1, dmx_address=1 → "1/001"
 */
export function formatAddress(universe, dmxAddress) {
  if (universe == null || dmxAddress == null) return '—'
  return `${universe}/${String(dmxAddress).padStart(3, '0')}`
}
