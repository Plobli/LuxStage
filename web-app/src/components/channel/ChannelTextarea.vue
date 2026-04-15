<template>
  <Textarea
    :value="modelValue"
    v-bind="$attrs"
    @focus="emit('focus')"
    @input="emit('update:modelValue', $event.target.value); emit('input')"
    @blur="emit('blur')"
    class="bg-transparent focus-visible:bg-white/5 focus-visible:outline-none focus-visible:ring-0 text-sm text-muted-foreground w-full px-2 border-0 resize-none leading-snug [field-sizing:content] min-h-14 py-4 align-middle rounded shadow-none"
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
