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
  <div :class="cn('flex items-center justify-end gap-2 px-6 py-4 bg-[#2c2c30] rounded-b-xl', props.class)">
    <slot />
  </div>
</template>
