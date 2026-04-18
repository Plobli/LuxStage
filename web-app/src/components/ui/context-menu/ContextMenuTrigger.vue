<template>
  <ContextMenuTrigger v-bind="$attrs">
    <slot />
  </ContextMenuTrigger>
</template>

<script setup>
import { ContextMenuTrigger } from 'radix-vue'
defineOptions({ inheritAttrs: false })
</script>
