<template>
  <TransitionRoot as="template" :show="open">
    <Dialog class="relative z-50" @close="$emit('cancel')">
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-150"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-950/80 transition-opacity" />
      </TransitionChild>

      <div class="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <TransitionChild
            as="template"
            enter="ease-out duration-200"
            enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enter-to="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-150"
            leave-from="opacity-100 translate-y-0 sm:scale-100"
            leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <DialogPanel class="relative transform overflow-hidden rounded-lg bg-gray-900 ring-1 ring-white/10 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
              <DialogTitle as="h3" class="text-base font-semibold text-white mb-4">
                {{ t('eos.preview.title') }}
              </DialogTitle>

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

              <div class="mt-5 sm:mt-4 flex sm:flex-row-reverse gap-3 flex-wrap">
                <button
                  type="button"
                  class="inline-flex w-full justify-center rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-accent-hover sm:w-auto"
                  @click="$emit('confirm')"
                >
                  {{ t('eos.preview.confirm') }}
                </button>
                <button
                  type="button"
                  class="inline-flex w-full justify-center rounded-md bg-white/5 px-3 py-2 text-sm font-semibold text-white shadow-xs ring-1 ring-white/10 hover:ring-white/20 sm:w-auto"
                  @click="$emit('cancel')"
                >
                  {{ t('action.cancel') }}
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue'
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
