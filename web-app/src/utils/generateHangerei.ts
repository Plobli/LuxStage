import type { Bar } from '../api/bars'
import type { Channel } from '../api/channels'
import type { MeasureUnit } from '../composables/useMeasureUnit'

export function formatHangPosition(cm: number, unit: MeasureUnit, cmToDisplay: (n: number) => number): string {
  if (cm === 0) return 'Mitte'
  const val = cmToDisplay(Math.abs(cm))
  return `${val}${unit} ${cm < 0 ? 'Links' : 'Rechts'}`
}

export function generateBarLine(
  bar: Bar,
  channelById: Map<string, Channel>,
  unit: MeasureUnit,
  cmToDisplay: (n: number) => number
): string {
  if (!bar.fixtures?.length) return ''
  const sorted = [...bar.fixtures].sort((a, b) => a.position - b.position)
  const parts = sorted.map(fx => {
    const ch = channelById.get(fx.channel_id)
    const tokens = [
      'V.',
      ch?.channel ?? '?',
      ch?.device || undefined,
      ch?.address ? `#${ch.address}` : undefined,
      ch?.color || undefined,
      formatHangPosition(fx.position, unit, cmToDisplay),
      fx.notes || undefined,
    ].filter(Boolean)
    return tokens.join(' ')
  })
  const line = `${bar.name}: ${parts.join(' • ')}`
  return bar.notes ? `${line} • ${bar.notes}` : line
}

export interface HangereiEntry {
  name: string
  text: string
}

export function generateHangereiEntries(
  bars: Bar[],
  channelById: Map<string, Channel>,
  unit: MeasureUnit,
  cmToDisplay: (n: number) => number
): HangereiEntry[] {
  return [...bars]
    .sort((a, b) => a.sort_order - b.sort_order)
    .flatMap(bar => {
      const line = generateBarLine(bar, channelById, unit, cmToDisplay)
      if (!line) return []
      const sep = bar.name + ': '
      const text = line.startsWith(sep) ? line.slice(sep.length) : line
      return [{ name: bar.name, text }]
    })
}

export function generateHangerei(
  bars: Bar[],
  channelById: Map<string, Channel>,
  unit: MeasureUnit,
  cmToDisplay: (n: number) => number
): string {
  return [...bars]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(bar => generateBarLine(bar, channelById, unit, cmToDisplay))
    .filter(Boolean)
    .join('\n')
}
