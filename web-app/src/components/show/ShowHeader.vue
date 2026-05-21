<template>
  <div class="shrink-0 border-b border-border" style="background: hsl(240 10% 6%)">
    <div class="flex h-12 shrink-0 items-center gap-x-3 px-4 sm:px-6 lg:px-8">
      <div class="flex items-baseline gap-x-3 min-w-0 flex-1">
        <h1
          v-if="!editingName"
          class="text-2xl font-semibold text-foreground truncate cursor-text hover:text-foreground/70 transition-colors"
          @click="startEditName"
        >{{ showName }}</h1>
        <input
          v-else
          ref="nameInput"
          :value="editName"
          @input="editName = $event.target.value"
          @blur="commitName"
          @keydown.enter.prevent="commitName"
          @keydown.esc.prevent="cancelName"
          class="text-2xl font-semibold text-foreground bg-transparent border-b border-accent outline-none min-w-20 flex-1"
        />
        <span v-if="showDate" class="text-sm text-muted-foreground shrink-0">{{ showDate }}</span>
      </div>

      <!-- Verlauf + Import + Export (Desktop) -->
      <div class="no-print hidden lg:flex items-center gap-x-2 shrink-0">
        <Button variant="ghost" size="sm" class="text-muted-foreground gap-1.5" @click="emit('openHistory')">
          <History class="size-3.5" />
          {{ labels.history }}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" class="text-muted-foreground hover:text-foreground flex items-center gap-1">
              {{ labels.import }}<ChevronDown class="size-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-56">
            <DropdownMenuItem class="cursor-pointer" @click="eosFileInput?.click()">{{ labels.eosImport }}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem class="cursor-pointer text-muted-foreground" @click="csvImportInput?.click()">{{ labels.csvImport }}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" class="text-muted-foreground hover:text-foreground flex items-center gap-1">
              {{ labels.export }}<ChevronDown class="size-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-56">
            <DropdownMenuItem class="cursor-pointer" @click="emit('openPdf')">{{ labels.pdf }}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem class="cursor-pointer text-muted-foreground" @click="emit('downloadCsv')">{{ labels.csvExport }}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <!-- Mobile Menu -->
      <div class="lg:hidden flex items-center shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" class="text-muted-foreground">
              <MoreVertical class="size-5" />
              <span class="sr-only">{{ t('show.header.menu_open') }}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-48">
            <DropdownMenuItem class="cursor-pointer" @click="emit('openHistory')">{{ labels.history }}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem class="cursor-pointer" @click="eosFileInput?.click()">{{ labels.eosImport }}</DropdownMenuItem>
            <DropdownMenuItem class="cursor-pointer text-muted-foreground" @click="csvImportInput?.click()">{{ labels.csvImport }}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem class="cursor-pointer" @click="emit('openPdf')">{{ labels.pdf }}</DropdownMenuItem>
            <DropdownMenuItem class="cursor-pointer text-muted-foreground" @click="emit('downloadCsv')">{{ labels.csvExport }}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <input ref="eosFileInput" type="file" accept=".csv" class="hidden" @change="emit('eosFileSelected', $event)" />
      <input ref="csvImportInput" type="file" accept=".csv" class="hidden" @change="emit('csvFileSelected', $event)" />
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { useLocale } from '@/composables/useLocale.js'
import { History, ChevronDown, MoreVertical } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

const { t } = useLocale()

const props = defineProps({
  showName: { type: String, default: '' },
  showDate: { type: String, default: '' },
  labels: {
    type: Object,
    default: () => ({
      history: 'Verlauf',
      import: 'Importieren', export: 'Exportieren',
      eosImport: 'EOS importieren', csvImport: 'CSV importieren',
      pdf: 'PDF', csvExport: 'CSV exportieren',
    }),
  },
})

const emit = defineEmits([
  'update:showName',
  'openHistory', 'openPdf', 'downloadCsv',
  'eosFileSelected', 'csvFileSelected',
])

const eosFileInput = ref(null)
const csvImportInput = ref(null)
const editingName = ref(false)
const editName = ref('')
const nameInput = ref(null)

async function startEditName() {
  editName.value = props.showName
  editingName.value = true
  await nextTick()
  nameInput.value?.focus()
  nameInput.value?.select()
}

function commitName() {
  const trimmed = editName.value.trim()
  if (trimmed && trimmed !== props.showName) emit('update:showName', trimmed)
  editingName.value = false
}

function cancelName() {
  editingName.value = false
}
</script>
