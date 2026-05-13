<template>
  <div class="flex flex-col items-center justify-center min-h-dvh gap-4 text-center px-4">
    <p class="text-6xl font-bold text-muted-foreground/30">404</p>
    <h1 class="text-xl font-semibold text-foreground">{{ t('not_found.title') }}</h1>
    <p class="text-sm text-muted-foreground max-w-xs">{{ t('not_found.text') }}</p>
    <RouterLink
      to="/"
      class="mt-2 inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 transition-opacity"
    >
      <Home class="size-4" />
      {{ t('not_found.home') }}
    </RouterLink>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router'
import { Home } from 'lucide-vue-next'
import { useLocale } from '@/composables/useLocale.js'
const { t } = useLocale()
</script>
