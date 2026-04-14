<template>
  <textarea
    :value="modelValue"
    v-bind="$attrs"
    @focus="emit('focus')"
    @input="emit('update:modelValue', $event.target.value); emit('input')"
    @blur="emit('blur')"
    class="bg-white/[0.04] focus:bg-white/[0.07] focus:outline-none focus:ring-0 text-sm text-gray-300 w-full px-2 border-0 resize-none leading-snug [field-sizing:content] min-h-14 py-4 align-middle rounded"
  />
</template>

<script setup>
defineOptions({ inheritAttrs: false })

defineProps({
  modelValue: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'input', 'focus', 'blur'])
</script>
