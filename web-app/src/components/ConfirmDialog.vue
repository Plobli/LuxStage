<template>
  <Dialog :open="open" @update:open="!$event && cancel()">
    <DialogContent class="sm:max-w-lg">
      <div class="sm:flex sm:items-start">
        <div class="mx-auto flex size-12 shrink-0 items-center justify-center rounded-full bg-red-500/10 sm:mx-0 sm:size-10">
          <AlertTriangle class="size-6 text-red-400" aria-hidden="true" />
        </div>
        <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
          <DialogTitle>{{ title }}</DialogTitle>
          <div class="mt-2">
            <p class="text-sm text-muted-foreground">{{ message }}</p>
          </div>
        </div>
      </div>
      <DialogFooter class="mt-5 sm:mt-4 gap-3">
        <button
          type="button"
          class="inline-flex w-full justify-center rounded-md bg-white/5 px-3 py-2 text-sm font-semibold text-white shadow-xs ring-1 ring-white/10 hover:ring-white/20 sm:w-auto"
          @click="cancel"
        >
          {{ cancelLabel }}
        </button>
        <button
          type="button"
          class="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-red-500 sm:w-auto"
          @click="confirm"
        >
          {{ confirmLabel }}
        </button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertTriangle } from 'lucide-vue-next'

const props = defineProps({
  open: { type: Boolean, required: true },
  title: { type: String, required: true },
  message: { type: String, default: '' },
  confirmLabel: { type: String, default: 'Löschen' },
  cancelLabel: { type: String, default: 'Abbrechen' },
})

const emit = defineEmits(['confirm', 'cancel'])

function confirm() { emit('confirm') }
function cancel() { emit('cancel') }
</script>
