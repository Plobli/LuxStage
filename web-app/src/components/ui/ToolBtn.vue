<template>
  <Button
    :title="title"
    :disabled="disabled"
    :variant="variant === 'danger' ? 'destructive' : (active ? 'default' : 'ghost')"
    size="icon"
    class="w-10 h-10"
    @click="!disabled && $emit('click')"
  >
    <slot />
  </Button>
</template>

<script setup>
import { Button } from '@/components/ui/button'
defineProps({
  active: Boolean,
  disabled: Boolean,
  variant: String,
  title: String
})
defineEmits(['click'])
</script>
