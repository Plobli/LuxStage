<template>
  <div class="relative">
    <Input
      :value="modelValue"
      @input="onInput"
      @focus="open = true"
      @blur="onBlur"
      @keydown.down="open && filtered.length ? (moveDown(), $event.preventDefault()) : null"
      @keydown.up="open && filtered.length ? (moveUp(), $event.preventDefault()) : null"
      @keydown.enter.prevent="open && filtered.length ? selectActive() : null"
      @keydown.escape="open = false"
      @keydown="$emit('keydown', $event)"
      :placeholder="placeholder"
      :style="badgeStyle || {}"
      :class="badgeStyle ? 'font-semibold' : 'bg-muted text-muted-foreground placeholder:text-muted-foreground/60'"
      class="focus-visible:ring-0 focus-visible:bg-muted/80 text-xs rounded-full px-2 py-0.5 border border-transparent focus-visible:border-border w-16 text-center h-6 shadow-none"
      v-bind="inputAttrs"
    />
    <ul
      v-if="open && filtered.length > 0"
      class="absolute left-0 top-full mt-1 z-50 w-72 max-h-48 overflow-y-auto rounded-md bg-popover text-popover-foreground border border-border shadow-xl text-sm"
    >
      <li
        v-for="(f, idx) in filtered"
        :key="f.code"
        @mousedown.prevent="select(f)"
        :class="[
          'flex items-center gap-2 px-3 py-1.5 cursor-pointer',
          idx === activeIdx ? 'bg-muted' : 'hover:bg-muted/50'
        ]"
      >
        <span
          class="size-4 rounded-full shrink-0 border border-border/50"
          :style="f.hex ? { backgroundColor: f.hex } : { backgroundColor: '#555' }"
        />
        <span class="text-foreground font-mono text-xs">{{ f.displayCode }}</span>
        <span class="text-muted-foreground text-xs truncate">{{ f.name }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Input } from '@/components/ui/input'
import { ALL_FILTERS, filterBadgeStyle } from '../utils/filterColors.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  inputAttrs: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:modelValue', 'change', 'keydown'])

const open = ref(false)
const activeIdx = ref(0)

const badgeStyle = computed(() => filterBadgeStyle(props.modelValue))

const filtered = computed(() => {
  const q = (props.modelValue || '').toUpperCase()
  if (!q) return ALL_FILTERS.slice(0, 12)

  const results = ALL_FILTERS.filter(f =>
    f.code.includes(q) ||
    f.code.slice(1).includes(q) ||
    (f.altCode && (f.altCode.includes(q) || f.altCode.slice(1).includes(q))) ||
    f.name.toUpperCase().includes(q)
  )

  // Prefer Rosco order only when user explicitly types "R" prefix
  const preferRosco = q.startsWith('R')

  function matchScore(f) {
    // Exakter Code-Match (z.B. "L200" oder "200" → L200)
    if (f.code.toUpperCase() === q) return 0
    if (f.code.slice(1) === q) return 1
    if (f.altCode && f.altCode.toUpperCase() === q) return 0
    if (f.altCode && f.altCode.slice(1) === q) return 1
    // Code enthält Query am Anfang der Nummer (z.B. "20" → L200 vor L2001)
    if (f.code.slice(1).startsWith(q)) return 2
    if (f.altCode && f.altCode.slice(1).startsWith(q)) return 2
    // Sonstiger Partial-Match (Mitte des Codes oder Name)
    return 3
  }

  results.sort((a, b) => {
    const sa = matchScore(a)
    const sb = matchScore(b)
    if (sa !== sb) return sa - sb
    // Bei gleichem Score: LEE vor Rosco (außer explizit R-Prefix)
    const aIsLee = a.code.startsWith('L')
    const bIsLee = b.code.startsWith('L')
    if (!preferRosco) {
      if (aIsLee !== bIsLee) return aIsLee ? -1 : 1
    } else {
      if (aIsLee !== bIsLee) return aIsLee ? 1 : -1
    }
    return 0
  })

  return results.slice(0, 12)
})

function onInput(e) {
  emit('update:modelValue', e.target.value)
  open.value = true
  activeIdx.value = 0
}

function onBlur() {
  setTimeout(() => { open.value = false }, 150)
  emit('change')
}

function select(f) {
  emit('update:modelValue', f.code)
  emit('change')
  open.value = false
}

function moveDown() { activeIdx.value = Math.min(activeIdx.value + 1, filtered.value.length - 1) }
function moveUp() { activeIdx.value = Math.max(activeIdx.value - 1, 0) }
function selectActive() { if (filtered.value[activeIdx.value]) select(filtered.value[activeIdx.value]) }
</script>
