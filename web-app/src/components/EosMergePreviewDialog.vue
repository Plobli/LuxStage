<template>
  <Dialog :open="open" @update:open="!$event && $emit('cancel')">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle class="mb-4">{{ t('eos.preview.title') }}</DialogTitle>
      </DialogHeader>

      <div class="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        <!-- Neu aktiv (gelb) -->
        <div v-if="newActive.length > 0">
          <div class="text-xs font-medium text-yellow-400 uppercase tracking-wide mb-1">
            {{ t('eos.preview.new_active', { n: newActive.length }) }}
          </div>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="ch in newActive"
              :key="ch.nr"
              class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs bg-yellow-500/15 text-yellow-300 ring-1 ring-yellow-500/30"
            >
              <span class="font-mono font-medium">{{ ch.nr }}</span>
              <span v-if="ch.label" class="text-yellow-400/70">{{ ch.label }}</span>
            </span>
          </div>
        </div>

        <!-- Inaktiv geworden (grau) -->
        <div v-if="nowGone.length > 0">
          <div class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
            {{ t('eos.preview.now_gone', { n: nowGone.length }) }}
          </div>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="ch in nowGone"
              :key="ch.nr"
              class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs bg-gray-500/15 text-gray-400 ring-1 ring-gray-500/30 line-through"
            >
              <span class="font-mono font-medium">{{ ch.nr }}</span>
              <span v-if="ch.label" class="text-gray-500">{{ ch.label }}</span>
            </span>
          </div>
        </div>

        <!-- Unangetastet (grün, haben Beschreibung) -->
        <div v-if="untouched.length > 0">
          <div class="text-xs font-medium text-emerald-400 uppercase tracking-wide mb-1">
            {{ t('eos.preview.untouched', { n: untouched.length }) }}
          </div>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="ch in untouched"
              :key="ch.nr"
              class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
            >
              <span class="font-mono font-medium">{{ ch.nr }}</span>
              <span v-if="ch.label" class="text-emerald-400/70">{{ ch.label }}</span>
            </span>
          </div>
        </div>

        <!-- Keine Änderungen -->
        <p v-if="newActive.length === 0 && nowGone.length === 0 && untouched.length === 0" class="text-sm text-gray-400">
          {{ t('eos.preview.empty') }}
        </p>
      </div>

      <DialogFooter class="mt-5 sm:mt-4 gap-3 flex-wrap">
        <Button variant="outline" class="w-full sm:w-auto" @click="$emit('cancel')">
          {{ t('action.cancel') }}
        </Button>
        <Button class="w-full sm:w-auto bg-accent hover:bg-accent/90 text-white" @click="$emit('confirm')">
          {{ t('eos.preview.confirm') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useLocale } from '../composables/useLocale.js'

const { t } = useLocale()

defineProps({
  open: { type: Boolean, required: true },
  // Array of { nr: string, label?: string }
  newActive: { type: Array, default: () => [] },
  nowGone:   { type: Array, default: () => [] },
  untouched: { type: Array, default: () => [] },
})

defineEmits(['confirm', 'cancel'])
</script>
