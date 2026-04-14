<template>
  <ContextMenuSeparator
    :class="cn('-mx-1 my-1 h-px bg-[--color-border]', $attrs.class)"
    v-bind="{ ...$attrs, class: undefined }"
  />
</template>

<script setup>
import { ContextMenuSeparator } from 'radix-vue'
import { cn } from '@/utils/cn'

defineOptions({ inheritAttrs: false })
</script>
