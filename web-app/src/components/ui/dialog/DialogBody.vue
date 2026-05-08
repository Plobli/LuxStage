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
  <div :class="cn('flex flex-col gap-4 px-6 py-5', props.class)">
    <slot />
  </div>
</template>
