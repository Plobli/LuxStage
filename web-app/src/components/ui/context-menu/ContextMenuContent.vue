<template>
  <ContextMenuContent
    :class="cn(
      'z-50 min-w-[10rem] overflow-hidden rounded-md border border-[--color-border]',
      'bg-[--color-popover] p-1 text-[--color-popover-foreground] shadow-md',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
      $attrs.class
    )"
    v-bind="{ ...$attrs, class: undefined }"
  >
    <slot />
  </ContextMenuContent>
</template>

<script setup>
import { ContextMenuContent } from 'radix-vue'
import { cn } from '@/utils/cn'

defineOptions({ inheritAttrs: false })
</script>
