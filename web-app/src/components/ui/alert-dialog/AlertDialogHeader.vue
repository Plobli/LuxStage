<script setup>
import { cn } from '@/utils/index';

const props = defineProps({
  class: {
    type: [Boolean, null, String, Object, Array],
    required: false,
    skipCheck: true,
  },
});
</script>

<template>
  <div
    :class="cn('flex items-start gap-3 px-6 py-5 border-b border-border', props.class)"
  >
    <slot />
  </div>
</template>
