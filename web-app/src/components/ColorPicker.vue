<template>
  <input
    v-model="value"
    type="text"
    placeholder="z.B. 201 / R02"
    class="bg-transparent focus:bg-white/5 focus:outline-none focus:ring-0 text-sm text-gray-300 w-full h-[45px] px-2 border-0"
    @click.stop
  />
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])

const value = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})
</script>
