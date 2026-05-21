<template>
  <Textarea
    ref="textareaEl"
    :model-value="modelValue"
    v-bind="$attrs"
    rows="1"
    @focus="handleFocus"
    @update:model-value="handleInput"
    @blur="handleBlur"
    :class="[
      'block min-h-10 w-full resize-none overflow-hidden rounded border-0 px-3 py-3 text-sm leading-4 text-foreground shadow-none transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-0',
      isFocused
        ? 'bg-primary/10 ring-1 ring-primary/60 cursor-text'
        : 'bg-transparent cursor-text hover:bg-muted/40 hover:ring-1 hover:ring-border',
    ]"
  />
</template>

<script setup>
import { nextTick, onMounted, ref, watch, onBeforeUnmount } from 'vue'
import { Textarea } from '@/components/ui/textarea'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  modelValue: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'input', 'focus', 'blur'])
const textareaEl = ref(null)
const isFocused = ref(false)

function getNativeTextarea() {
  return textareaEl.value?.$el instanceof HTMLTextAreaElement
    ? textareaEl.value.$el
    : textareaEl.value
}

function autoResize() {
  const el = getNativeTextarea()
  if (!el) return
  el.style.height = '1px'
  el.style.height = `${Math.max(40, el.scrollHeight)}px`
}

function handleInput(val) {
  emit('update:modelValue', val)
  emit('input', val)
  nextTick(autoResize)
}

function handleFocus(event) {
  isFocused.value = true
  emit('focus', event)
  nextTick(autoResize)
}

function handleBlur(event) {
  isFocused.value = false
  emit('blur', event)
  nextTick(autoResize)
}

let intersectionObserver = null

watch(() => props.modelValue, () => nextTick(autoResize))
onMounted(() => {
  const el = getNativeTextarea()
  if (!el) return

  intersectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        nextTick(autoResize)
      }
    })
  }, { threshold: 0.1 })

  intersectionObserver.observe(el)
  nextTick(autoResize)
})

onBeforeUnmount(() => {
  intersectionObserver?.disconnect()
})
</script>
