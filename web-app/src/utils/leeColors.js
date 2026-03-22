// Lee filter approximate display colors (hex).
// Source: Lee Filters swatch reference. Not scientifically precise —
// intended for visual identification only.
const LEE = {
  'L002': '#f9c6d0', // Rose Pink
  'L003': '#fde8d8', // Pale Lavender
  'L004': '#f7c5d5', // Medium Bastard Amber
  'L007': '#fde7c2', // Pale Yellow
  'L008': '#fde080', // Pale Gold
  'L009': '#fcd36e', // Pale Amber Gold
  'L010': '#f9c74f', // Medium Yellow
  'L013': '#f8c000', // Straw
  'L015': '#f4a700', // Deep Straw
  'L019': '#e85d00', // Fire
  'L020': '#f08000', // Medium Amber
  'L021': '#e87000', // Golden Amber
  'L022': '#c85000', // Deep Amber
  'L023': '#e84000', // Orange
  'L024': '#d03020', // Scarlet
  'L025': '#e85030', // Sunset Red
  'L026': '#e04040', // Light Red
  'L027': '#c82020', // Medium Red
  'L029': '#b01010', // Heavy Frost (neutral)
  'L036': '#e85090', // Medium Pink
  'L043': '#d060c0', // Deep Magenta
  'L044': '#b050b0', // Middle Rose
  'L048': '#c040a0', // Rose Purple
  'L052': '#9060c0', // Light Lavender
  'L053': '#7050b0', // Paler Lavender
  'L055': '#6070c0', // Lilac
  'L058': '#4060b0', // Lavender
  'L061': '#3050a0', // Mist Blue
  'L063': '#2040a0', // Pale Blue
  'L068': '#1030c0', // Sky Blue
  'L071': '#0020b0', // Sea Blue
  'L079': '#001090', // Just Blue
  'L085': '#002080', // Deeper Blue
  'L088': '#001870', // Pale Navy Blue
  'L090': '#000860', // Dark Blue
  'L100': '#f0e060', // Spring Yellow
  'L101': '#d0c840', // Yellow
  'L102': '#c0a000', // Light Amber
  'L103': '#a07800', // Straw
  'L104': '#806000', // Deep Amber
  'L105': '#604000', // Orange
  'L106': '#c04020', // Primary Red
  'L111': '#8010a0', // Dark Pink
  'L113': '#6000a0', // Magenta
  'L116': '#4000c0', // Medium Blue-Green
  'L119': '#0050a0', // Dark Blue
  'L120': '#003090', // Deep Blue
  'L121': '#007040', // Leaf Green
  'L122': '#008060', // Fern Green
  'L124': '#006040', // Dark Green
  'L125': '#004020', // Dark Green 2
  'L126': '#003010', // Mauve
  'L128': '#602080', // Bright Pink
  'L129': '#800060', // Heavy Frost 2
  'L130': '#906050', // Clear
  'L131': '#c08060', // Marine Blue
  'L132': '#4080c0', // Medium Blue
  'L134': '#f0c040', // Golden Amber
  'L135': '#e0a000', // Deep Golden Amber
  'L136': '#c07000', // Pale Lavender
  'L137': '#fce8f0', // Special Rose Pink
  'L138': '#fdd0e0', // Pale Rose
  'L139': '#fcc0d0', // Primary Green
  'L140': '#00a040', // Summer Blue
  'L141': '#00c0e0', // Bright Blue
  'L142': '#00a0d0', // Pale Blue 2
  'L143': '#0080c0', // Pale Navy
  'L144': '#0060a0', // No Color Blue
  'L147': '#fdf0c0', // Apricot
  'L148': '#fcd890', // Bright Rose
  'L150': '#f0a0c0', // Pale Rose Pink
  'L152': '#e08090', // Pale Gold 2
  'L154': '#f0d070', // Pale Amber
  'L156': '#e8b840', // Chocolate
  'L157': '#804020', // Light Rose
  'L158': '#f8c0c0', // Deep Rose
  'L159': '#e090a0', // No Color Straw
  'L161': '#f8e080', // Slate Blue
  'L162': '#809090', // Bastard Amber
  'L163': '#d0b080', // Pale Gold 3
  'L164': '#c0a060', // Flame Red
  'L166': '#d04000', // Pale Amber Gold 2
  'L170': '#f0c060', // Deep Blue 2
  'L172': '#0050c0', // Lagoon Blue
  'L173': '#00a0c0', // Cyan
  'L174': '#00c0c0', // Daylight Blue
  'L176': '#b0d0e0', // Pale Teal
  'L179': '#40b0a0', // Chrome Orange
  'L180': '#e86020', // Congo Blue
  'L181': '#1000a0', // Congo Blue 2
  'L182': '#2000c0', // Light Amber 2
  'L183': '#e0a040', // Cosmetic Silver Rose
  'L187': '#f0d0c0', // Cosmetic Wild Rose
  'L188': '#e0b0a0', // Cosmetic Peach
  'L189': '#d0a090', // Cosmetic Highlight
  'L190': '#e8c0b0', // Cosmetic Silver Blue
  'L191': '#c0d0e0', // Cosmetic Highlight 2
  'L192': '#d0c0d0', // Flesh Pink
  'L193': '#f0c0b0', // Cosmetic Highlight 3
  'L194': '#e0b0a8', // Surprise Pink
  'L195': '#e8a080', // Deep Gold
  'L196': '#c08040', // Soft Gold
  'L197': '#d09050', // Alice Blue
  'L200': '#c0e0f8', // Double CT Blue
  'L201': '#a0d0f0', // Full CT Blue
  'L202': '#d0e8f8', // 1/2 CT Blue
  'L203': '#e8f4fc', // 1/4 CT Blue
  'L204': '#f0f8fe', // 1/8 CT Blue
  'L205': '#fff8e0', // 1/8 CT Orange
  'L206': '#ffe8c0', // 1/4 CT Orange
  'L281': '#ffd090', // 1/2 CT Orange
  'L285': '#ffc060', // Full CT Orange
}

/**
 * Given a color string (e.g. "L201", "L201 / R02", "201"),
 * returns the best-match hex color or null.
 */
export function leeColorHex(input) {
  if (!input) return null
  // Try direct match with L prefix
  const upper = input.trim().toUpperCase()
  // Extract first token, normalize to L###
  const match = upper.match(/L?\s*(\d{3})/)
  if (!match) return null
  const key = `L${match[1]}`
  return LEE[key] ?? null
}

/**
 * Returns a CSS background color string for a filter badge,
 * or a neutral fallback.
 */
export function filterBadgeStyle(input) {
  const hex = leeColorHex(input)
  if (!hex) return null
  return { backgroundColor: hex, color: textColorForBg(hex) }
}

function textColorForBg(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  // Perceived luminance
  const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return l > 0.5 ? '#000000' : '#ffffff'
}
