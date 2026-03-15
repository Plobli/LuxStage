<template>
  <input
    v-model="value"
    type="text"
    placeholder="z.B. 201 / R02"
    class="inline-input inline-input-color"
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
