<template>
  <div class="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
    <p class="text-6xl font-bold text-muted-foreground/30">404</p>
    <h1 class="text-xl font-semibold text-foreground">Seite nicht gefunden</h1>
    <p class="text-sm text-muted-foreground max-w-xs">
      Die aufgerufene URL existiert nicht. Möglicherweise wurde sie verschoben oder der Link ist falsch.
    </p>
    <RouterLink
      to="/"
      class="mt-2 inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 transition-opacity"
    >
      <Home class="size-4" />
      Zur Startseite
    </RouterLink>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router'
import { Home } from 'lucide-vue-next'
</script>
