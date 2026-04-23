<template>
  <Button
    variant="outline"
    size="sm"
    :title="title"
    class="h-7 text-xs px-2"
    @click="$emit('click')"
  >
    <slot />
  </Button>
</template>

<script setup>
import { Button } from '@/components/ui/button'
defineProps({
  title: String
})
defineEmits(['click'])
</script>
