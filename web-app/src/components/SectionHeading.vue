<template>
  <div class="flex items-center">
    <span class="pr-3 text-lg font-semibold text-accent bg-gray-950 shrink-0">{{ text }}</span>
    <div class="w-full border-t border-accent/40" aria-hidden="true"></div>
  </div>
</template>

<script setup>
defineProps({ text: { type: String, required: true } })
</script>
