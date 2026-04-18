<template>
  <Textarea
    ref="textareaEl"
    :model-value="modelValue"
    v-bind="$attrs"
    rows="1"
    @focus="handleFocus"
    @update:model-value="handleInput"
    @blur="handleBlur"
    class="block min-h-10 w-full resize-none overflow-hidden rounded-none border-0 bg-transparent px-3 py-3 text-sm leading-4 text-foreground shadow-none transition-colors placeholder:text-muted-foreground/25 focus-visible:outline-none focus-visible:ring-0"
  />
</template>

<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import { Textarea } from '@/components/ui/textarea'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  modelValue: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'input', 'focus', 'blur'])
const textareaEl = ref(null)

function getNativeTextarea() {
  return textareaEl.value?.$el instanceof HTMLTextAreaElement
    ? textareaEl.value.$el
    : textareaEl.value
}

function autoResize() {
  const el = getNativeTextarea()
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.max(40, el.scrollHeight)}px`
}

function handleInput(val) {
  emit('update:modelValue', val)
  emit('input', val)
  nextTick(autoResize)
}

function handleFocus(event) {
  emit('focus', event)
  nextTick(autoResize)
}

function handleBlur(event) {
  emit('blur', event)
  nextTick(autoResize)
}

watch(() => props.modelValue, () => nextTick(autoResize))
onMounted(() => nextTick(autoResize))
</script>
