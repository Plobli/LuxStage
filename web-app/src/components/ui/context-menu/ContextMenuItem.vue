<template>
  <ContextMenuItem
    :class="cn(
      'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
      'transition-colors focus:bg-[--color-secondary] focus:text-[--color-foreground]',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      inset && 'pl-8',
      $attrs.class
    )"
    v-bind="{ ...$attrs, class: undefined }"
  >
    <slot />
  </ContextMenuItem>
</template>

<script setup>
import { ContextMenuItem } from 'radix-vue'
import { cn } from '@/utils/cn'

defineOptions({ inheritAttrs: false })
defineProps({
  inset: { type: Boolean, default: false },
})
</script>
