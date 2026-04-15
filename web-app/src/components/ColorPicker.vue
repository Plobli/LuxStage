<template>
  <Input
    v-model="value"
    type="text"
    placeholder="z.B. 201 / R02"
    class="bg-transparent focus-visible:bg-white/5 focus-visible:outline-none focus-visible:ring-0 text-sm text-muted-foreground w-full h-[45px] px-2 border-0 shadow-none"
    @click.stop
  />
</template>

<script setup>
import { computed } from 'vue'
import { Input } from '@/components/ui/input'

const props = defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])

const value = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})
</script>
