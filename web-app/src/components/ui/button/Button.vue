<template>
  <component
    :is="as"
    :class="cn(buttonVariants({ variant, size }), $attrs.class)"
    v-bind="{ ...$attrs, class: undefined }"
  >
    <slot />
  </component>
</template>

<script setup>
import { cn } from '@/utils/cn'
import { buttonVariants } from './index.js'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  as: { type: [String, Object], default: 'button' },
  variant: { type: String, default: 'default' },
  size: { type: String, default: 'default' },
})
</script>
