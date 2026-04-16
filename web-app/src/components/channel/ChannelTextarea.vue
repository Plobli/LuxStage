<template>
  <Textarea
    :model-value="modelValue"
    v-bind="$attrs"
    @focus="emit('focus')"
    @update:model-value="val => { emit('update:modelValue', val); emit('input', val) }"
    @blur="emit('blur')"
    class="bg-background/50 border border-border/40 hover:border-border focus-visible:bg-background focus-visible:outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring text-sm text-foreground w-full px-2.5 resize-none leading-snug h-8 py-1.5 rounded-md shadow-sm transition-colors"
  />
</template>

<script setup>
import { Textarea } from '@/components/ui/textarea'

defineOptions({ inheritAttrs: false })

defineProps({
  modelValue: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'input', 'focus', 'blur'])
</script>
