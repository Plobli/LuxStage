<template>
  <div class="relative">
    <input
      :value="modelValue"
      @input="onInput"
      @focus="open = true"
      @blur="onBlur"
      @keydown.down.prevent="moveDown"
      @keydown.up.prevent="moveUp"
      @keydown.enter.prevent="selectActive"
      @keydown.escape="open = false"
      :placeholder="placeholder"
      :style="badgeStyle || {}"
      :class="badgeStyle ? 'font-semibold' : 'bg-white/10 text-gray-400 placeholder:text-gray-600'"
      class="focus:outline-none text-xs rounded-full px-2 py-0.5 border-0 w-16 text-center"
    />
    <ul
      v-if="open && filtered.length > 0"
      class="absolute left-0 top-full mt-1 z-50 w-56 max-h-48 overflow-y-auto rounded-md bg-gray-900 ring-1 ring-white/10 shadow-xl text-sm"
    >
      <li
        v-for="(f, idx) in filtered"
        :key="f.code"
        @mousedown.prevent="select(f)"
        :class="[
          'flex items-center gap-2 px-3 py-1.5 cursor-pointer',
          idx === activeIdx ? 'bg-white/10' : 'hover:bg-white/5'
        ]"
      >
        <span
          class="size-4 rounded-full shrink-0 ring-1 ring-white/10"
          :style="f.hex ? { backgroundColor: f.hex } : { backgroundColor: '#555' }"
        />
        <span class="text-white font-mono text-xs">{{ f.displayCode }}</span>
        <span class="text-gray-400 text-xs truncate">{{ f.name }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ALL_FILTERS, filterBadgeStyle } from '../utils/filterColors.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'change'])

const open = ref(false)
const activeIdx = ref(0)

const badgeStyle = computed(() => filterBadgeStyle(props.modelValue))

const filtered = computed(() => {
  const q = (props.modelValue || '').toUpperCase()
  if (!q) return ALL_FILTERS.slice(0, 12)
  return ALL_FILTERS.filter(f =>
    f.code.includes(q) ||
    f.code.slice(1).includes(q) ||
    (f.altCode && (f.altCode.includes(q) || f.altCode.slice(1).includes(q))) ||
    f.name.toUpperCase().includes(q)
  ).slice(0, 12)
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
