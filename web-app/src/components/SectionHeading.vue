<template>
  <div class="flex items-center">
    <span class="pr-3 text-lg font-semibold text-accent bg-background shrink-0">{{ text }}</span>
    <Separator class="flex-1 bg-accent/40" />
  </div>
</template>

<script setup>
import { Separator } from '@/components/ui/separator'

defineProps({ text: { type: String, required: true } })
</script>
