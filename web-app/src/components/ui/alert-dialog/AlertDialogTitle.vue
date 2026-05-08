<script setup>
import { reactiveOmit } from "@vueuse/core";
import { AlertDialogTitle } from "reka-ui";
import { cn } from '@/utils/index';

const props = defineProps({
  asChild: { type: Boolean, required: false },
  as: { type: null, required: false },
  class: {
    type: [Boolean, null, String, Object, Array],
    required: false,
    skipCheck: true,
  },
});

const delegatedProps = reactiveOmit(props, "class");
</script>

<template>
  <AlertDialogTitle
    v-bind="delegatedProps"
    :class="cn('text-base font-semibold leading-snug text-foreground', props.class)"
  >
    <slot />
  </AlertDialogTitle>
</template>
