<template>
  <Loader2 :class="cn('animate-spin text-muted-foreground', sizeClass, props.class)" />
</template>

<script setup>
import { computed } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import { cn } from '@/utils'

const props = defineProps({
  size: { type: String, default: 'md' }, // 'sm' | 'md' | 'lg'
  class: { type: String, default: '' },
})

const sizeClass = computed(() => {
  if (props.size === 'sm') return 'size-4'
  if (props.size === 'lg') return 'size-8'
  return 'size-5'
})
</script>
