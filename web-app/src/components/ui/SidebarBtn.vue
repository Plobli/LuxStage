<template>
  <button
    :disabled="disabled"
    :title="!expanded ? title : undefined"
    :class="[
      'flex items-center gap-2 py-1.5 rounded-md text-sm font-medium transition-colors select-none',
      expanded ? 'w-[calc(100%-8px)] px-2 mx-1 justify-start' : 'w-8 h-8 mx-auto justify-center',
      active
        ? 'bg-accent/85 text-accent-foreground'
        : variant === 'danger'
          ? 'text-destructive hover:bg-destructive/10'
          : 'text-foreground hover:bg-muted',
      disabled && 'opacity-40 pointer-events-none',
    ]"
    @click="!disabled && $emit('click')"
  >
    <slot />
  </button>
</template>

<script setup>
defineProps({
  active: Boolean,
  disabled: Boolean,
  variant: String,
  expanded: Boolean,
  title: String,
})
defineEmits(['click'])
</script>
