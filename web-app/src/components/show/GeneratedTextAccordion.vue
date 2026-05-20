<template>
  <div class="mx-6 mt-6 mb-8 flex flex-col gap-5">
    <p class="text-base font-semibold text-foreground">Automatisch generiert</p>

    <template v-if="gassenturmEntries.length">
      <div class="flex flex-col gap-1.5">
        <p class="text-base font-bold text-foreground mt-2 mb-1">Bühne</p>
        <div
          v-for="entry in gassenturmEntries"
          :key="entry.name"
          class="text-sm text-foreground/80 leading-relaxed select-all"
        >
          <span class="font-semibold text-foreground">{{ entry.name }}:</span> {{ entry.text }}
        </div>
      </div>
    </template>

    <template v-if="hangereiEntries.length">
      <div class="flex flex-col gap-1.5">
        <p class="text-base font-bold text-foreground mt-2 mb-1">Obermaschinerie</p>
        <div
          v-for="entry in hangereiEntries"
          :key="entry.name"
          class="text-sm text-foreground/80 leading-relaxed select-all"
        >
          <span class="font-semibold text-foreground">{{ entry.name }}:</span> {{ entry.text }}
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
defineProps({
  gassenturmEntries: { type: Array, default: () => [] },
  hangereiEntries: { type: Array, default: () => [] },
})
</script>
