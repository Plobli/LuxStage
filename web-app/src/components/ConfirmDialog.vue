<template>
  <AlertDialog :open="open" @update:open="!$event && cancel()">
    <AlertDialogContent class="sm:max-w-lg">
      <AlertDialogHeader class="flex sm:flex-row items-start gap-4">
        <div class="mx-auto flex size-12 shrink-0 items-center justify-center rounded-full bg-red-500/10 sm:mx-0 sm:size-10">
          <AlertTriangle class="size-5 text-red-400" aria-hidden="true" />
        </div>
        <div class="mt-3 text-center sm:mt-0 sm:text-left">
          <AlertDialogTitle>{{ title }}</AlertDialogTitle>
          <AlertDialogDescription class="mt-2">{{ message }}</AlertDialogDescription>
        </div>
      </AlertDialogHeader>
      <AlertDialogFooter class="mt-5 sm:mt-4 gap-3">
        <AlertDialogCancel @click="cancel">
          {{ cancelLabel }}
        </AlertDialogCancel>
        <AlertDialogAction
          @click="confirm"
          :class="buttonVariants({ variant: 'destructive' })"
        >
          {{ confirmLabel }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script setup>
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'
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
