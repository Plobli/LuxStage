<script setup>
import { useVModel } from "@vueuse/core";
import { cn } from '@/utils/index';

const props = defineProps({
  defaultValue: { type: [String, Number], required: false },
  modelValue: { type: [String, Number], required: false },
  size: { type: String, default: 'default' }, // 'default' | 'lg'
  class: {
    type: [Boolean, null, String, Object, Array],
    required: false,
    skipCheck: true,
  },
});

const emits = defineEmits(["update:modelValue"]);

const modelValue = useVModel(props, "modelValue", emits, {
  defaultValue: props.defaultValue,
});
</script>

<template>
  <input
    v-model="modelValue"
    :class="cn(
      'flex w-full border border-input bg-background file:border-0 file:bg-transparent file:text-foreground file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
      props.size === 'lg'
        ? 'h-12 rounded-xl bg-card border-input px-4 text-base'
        : 'h-10 rounded-xl px-3 py-2 text-sm',
      props.class,
    )"
  />
</template>
