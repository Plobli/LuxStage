<template>
  <textarea
    :class="cn(
      'flex min-h-[60px] w-full rounded-md border border-[--color-border] bg-transparent px-3 py-2 text-sm shadow-sm',
      'placeholder:text-[--color-muted-foreground]',
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-ring]',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'resize-none',
      $attrs.class
    )"
    v-bind="{ ...$attrs, class: undefined }"
    :value="modelValue"
    @input="$emit('update:modelValue', $event.target.value)"
  />
</template>

<script setup>
import { cn } from '@/utils/cn'

defineOptions({ inheritAttrs: false })

defineProps({
  modelValue: { type: String, default: '' },
})
defineEmits(['update:modelValue'])
</script>
