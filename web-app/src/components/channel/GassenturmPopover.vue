<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      @click.self="emit('cancel')"
    >
      <div class="flex flex-col gap-4 p-6 w-md rounded-xl border border-border bg-card shadow-2xl">
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold text-foreground">Gassenturm</span>
          <button
            v-if="ch.gassenturmAssignment"
            class="text-[10px] text-red-400 hover:text-red-500 transition-colors"
            @click="confirmRemove"
          >Entfernen</button>
        </div>

        <!-- Turm-Auswahl -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-muted-foreground">Gassenturm</label>
          <div class="relative">
            <button
              type="button"
              @click="dropdownOpen = !dropdownOpen"
              class="h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-left shadow-sm flex items-center justify-between focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <span :class="form.turmname ? 'text-foreground' : 'text-muted-foreground/40'">
                {{ form.turmname || 'Turm wählen…' }}
              </span>
              <div class="flex items-center gap-2">
                <span v-if="form.turmname" class="text-xs text-muted-foreground">{{ richtungLabel(form.richtung) }}</span>
                <svg class="size-3.5 text-muted-foreground/50 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
              </div>
            </button>
            <div
              v-if="dropdownOpen"
              class="absolute left-0 right-0 top-9 z-10 rounded-md border border-border bg-card shadow-lg overflow-hidden"
            >
              <button
                v-for="name in existingTowerNames"
                :key="name"
                type="button"
                @click="selectTower(name)"
                class="w-full px-3 py-2 text-sm text-left hover:bg-muted/60 transition-colors flex items-center justify-between"
                :class="form.turmname === name ? 'text-accent font-semibold' : 'text-foreground'"
              >
                <span>{{ name }}</span>
                <span class="text-xs text-muted-foreground">{{ richtungLabel(props.towerMeta[name]?.richtung) }}</span>
              </button>

              <!-- Neuer Gassenturm inline -->
              <div class="border-t border-border/60">
                <div v-if="!newTowerMode" >
                  <button
                    type="button"
                    @click="newTowerMode = true; $nextTick(() => $refs.newNameInput?.focus())"
                    class="w-full px-3 py-2 text-sm text-left text-accent hover:bg-accent/10 transition-colors font-medium"
                  >+ Neuer Gassenturm</button>
                </div>
                <div v-else class="flex gap-2 px-3 py-2 items-center">
                  <input
                    ref="newNameInput"
                    v-model="newTowerName"
                    placeholder="Name"
                    class="flex-1 h-7 rounded border border-input bg-background px-2 text-sm shadow-sm placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    @keydown.enter.prevent="confirmNewTower"
                    @keydown.escape="newTowerMode = false"
                  />
                  <select
                    v-model="newTowerRichtung"
                    class="h-7 rounded border border-input bg-background px-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="L">Links</option>
                    <option value="C">Mitte</option>
                    <option value="R">Rechts</option>
                  </select>
                  <button type="button" @click="confirmNewTower" class="h-7 px-2 rounded bg-accent text-accent-foreground text-xs font-semibold hover:bg-accent/90">OK</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Position im Turm -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-muted-foreground">
            Position im Turm <span class="text-muted-foreground/50">(von oben, 1 = oberster Slot)</span>
          </label>
          <input
            v-model.number="form.position"
            type="number"
            min="1"
            placeholder="1"
            :class="[
              'h-8 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              positionConflict ? 'border-yellow-400/70 ring-1 ring-yellow-400/40' : 'border-input'
            ]"
          />
          <p v-if="positionConflict" class="text-[11px] text-yellow-400 leading-snug">
            Position {{ form.position }} in „{{ form.turmname }}" belegt durch Kanal {{ positionConflict }}
          </p>
        </div>

        <!-- Aufbau-Notiz -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-muted-foreground">Aufbau-Notiz (optional)</label>
          <textarea
            v-model="form.notiz"
            rows="2"
            placeholder="z. B. Kabel links führen"
            class="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm resize-none placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div class="flex gap-2 justify-end pt-1">
          <button
            class="h-7 rounded-md px-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            @click="emit('cancel')"
          >Abbrechen</button>
          <button
            :disabled="!form.turmname || !form.position"
            class="h-7 rounded-md px-3 text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            @click="save"
          >Speichern</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { reactive, ref, watch, computed } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  ch: { type: Object, required: true },
  existingTowerNames: { type: Array, default: () => [] },
  allChannels: { type: Array, default: () => [] },
  towerMeta: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['save', 'cancel', 'remove', 'updateTower'])

const form = reactive({ turmname: '', position: null, richtung: 'C', notiz: '' })
const dropdownOpen = ref(false)
const newTowerMode = ref(false)
const newTowerName = ref('')
const newTowerRichtung = ref('C')

const RICHTUNG_LABELS = { L: 'Links', C: 'Mitte', R: 'Rechts' }
function richtungLabel(r) { return RICHTUNG_LABELS[r] ?? '' }

function selectTower(name) {
  form.turmname = name
  form.richtung = props.towerMeta[name]?.richtung ?? 'C'
  dropdownOpen.value = false
  newTowerMode.value = false
}

function confirmNewTower() {
  const name = newTowerName.value.trim()
  if (!name) return
  emit('updateTower', name, { richtung: newTowerRichtung.value, notiz: '' })
  form.turmname = name
  form.richtung = newTowerRichtung.value
  dropdownOpen.value = false
  newTowerMode.value = false
  newTowerName.value = ''
  newTowerRichtung.value = 'C'
}

function confirmRemove() {
  if (!confirm(`Gassenturm-Zuweisung für Kanal ${props.ch.channel} entfernen?`)) return
  emit('remove')
}

const positionConflict = computed(() => {
  if (!form.turmname || !form.position) return null
  for (const other of props.allChannels) {
    if (other === props.ch) continue
    const a = other.gassenturmAssignment
    if (a?.turmname === form.turmname && a?.position === form.position) {
      return other.channel || '?'
    }
  }
  return null
})

watch(() => [props.open, props.ch.gassenturmAssignment], () => {
  const a = props.ch.gassenturmAssignment
  form.turmname = a?.turmname ?? ''
  form.position = a?.position ?? null
  form.richtung = props.towerMeta[form.turmname]?.richtung ?? 'C'
  form.notiz = a?.notiz ?? ''
  dropdownOpen.value = false
  newTowerMode.value = false
}, { immediate: true })

watch(() => form.turmname, (name) => {
  if (name && props.towerMeta[name]) {
    form.richtung = props.towerMeta[name].richtung ?? 'C'
  }
})

function save() {
  if (!form.turmname || !form.position) return
  const existingMeta = props.towerMeta[form.turmname] ?? {}
  emit('updateTower', form.turmname, { ...existingMeta, richtung: form.richtung })
  emit('save', { turmname: form.turmname, position: Number(form.position), notiz: form.notiz || '' })
}
</script>
