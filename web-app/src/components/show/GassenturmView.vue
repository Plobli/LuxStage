<template>
  <div class="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-6">
    <!-- Neuen Turm anlegen -->
    <div v-if="!addingTower" class="flex">
      <button
        type="button"
        @click="addingTower = true"
        class="h-8 rounded-md px-3 text-sm text-accent border border-dashed border-accent/40 hover:bg-accent/10 transition-colors"
      >+ Gassenturm anlegen</button>
    </div>
    <div v-else class="flex items-center gap-2">
      <input
        ref="addNameInput"
        v-model="addName"
        placeholder="Turmname"
        class="h-8 rounded-md border border-input bg-background px-3 text-sm shadow-sm placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        @keydown.enter.prevent="confirmAdd"
        @keydown.escape="addingTower = false"
      />
      <select
        v-model="addRichtung"
        class="h-8 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="L">Links</option>
        <option value="C">Mitte</option>
        <option value="R">Rechts</option>
      </select>
      <button type="button" @click="confirmAdd" class="h-8 px-3 rounded-md bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent/90">Anlegen</button>
      <button type="button" @click="addingTower = false" class="h-8 px-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60">Abbrechen</button>
    </div>

    <div v-if="towers.length === 0" class="flex flex-col items-center gap-3 rounded-md border border-dashed border-border/60 bg-muted/5 px-6 py-12">
      <p class="text-sm text-muted-foreground text-center">Keine Gassenturm-Zuordnungen vorhanden.<br>Lege hier einen Turm an oder aktiviere den Schalter in der Kanaltabelle.</p>
    </div>

    <div v-if="towers.length > 0" class="grid gap-6 items-start" style="grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))">
      <div
        v-for="tower in towers"
        :key="tower.name"
        class="flex flex-col gap-0 rounded-lg border border-border/60 bg-card overflow-hidden"
      >
        <!-- Tower header -->
        <div class="flex items-center gap-2 px-4 py-3 bg-muted/60 border-b border-border/60">
          <input
            :value="tower.name"
            @change="renameTower(tower.name, $event.target.value.trim())"
            class="flex-1 min-w-0 h-7 rounded border border-transparent bg-transparent px-1 text-sm font-semibold uppercase tracking-widest text-foreground/90 focus:border-input focus:bg-background focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
          />
          <select
            :value="towerMeta[tower.name]?.richtung ?? 'C'"
            @change="updateMeta(tower.name, 'richtung', $event.target.value)"
            class="h-7 rounded border border-input bg-background px-2 text-sm font-semibold text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="L">Links</option>
            <option value="C">Mitte</option>
            <option value="R">Rechts</option>
          </select>
          <span class="text-xs text-muted-foreground shrink-0">{{ tower.slots.length }} Pos.</span>
        </div>

        <!-- Tower Notiz -->
        <div class="px-4 py-2 border-b border-border/40 bg-muted/10">
          <textarea
            :value="towerMeta[tower.name]?.notiz ?? ''"
            @change="updateMeta(tower.name, 'notiz', $event.target.value)"
            rows="2"
            placeholder="Turm-Notiz (optional)"
            class="w-full rounded bg-transparent text-sm text-muted-foreground placeholder:text-muted-foreground/30 resize-none focus:outline-none focus:text-foreground leading-snug"
          />
        </div>

        <!-- Slots -->
        <div
          v-for="slot in tower.slots"
          :key="slot.ch.gassenturmAssignment.position"
          class="flex items-start gap-3 px-4 py-3 border-b border-border/40 last:border-b-0 group/slot"
        >
          <!-- Position number + delete -->
          <div class="shrink-0 flex flex-col items-center gap-1 mt-0.5">
            <div class="w-7 h-7 rounded-full bg-muted/60 flex items-center justify-center text-xs font-mono font-semibold text-muted-foreground">
              {{ slot.ch.gassenturmAssignment.position }}
            </div>
            <button
              type="button"
              @click="removeSlot(slot.ch)"
              class="opacity-0 group-hover/slot:opacity-100 transition-opacity size-6 flex items-center justify-center rounded text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10"
              title="Position entfernen"
            >
              <svg class="size-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd"/></svg>
            </button>
          </div>

          <!-- Editable fields -->
          <div class="flex-1 min-w-0 flex flex-col gap-1.5">
            <!-- Row 1: Kanal + Farbe -->
            <div class="flex items-center gap-2">
              <input
                v-model="slot.ch.channel"
                @input="emit('change')"
                placeholder="Kanal"
                class="w-16 h-7 rounded border border-input bg-background px-2 text-sm font-mono font-semibold text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <div class="flex items-center gap-1.5 flex-1">
                <span
                  v-if="slot.ch.color"
                  class="inline-block size-3 rounded-full shrink-0 border border-border/30"
                  :style="colorStyle(slot.ch.color)"
                />
                <input
                  v-model="slot.ch.color"
                  @input="emit('change')"
                  placeholder="Farbe"
                  class="flex-1 h-7 rounded border border-input bg-background px-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
            <!-- Row 2: Gerät -->
            <input
              v-model="slot.ch.device"
              @input="emit('change')"
              placeholder="Gerät"
              class="w-full h-7 rounded border border-input bg-background px-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <!-- Row 3: Notizen -->
            <input
              v-model="slot.ch.notes"
              @input="emit('change')"
              placeholder="Notizen"
              class="w-full h-7 rounded border border-input bg-background px-2 text-sm text-muted-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <!-- Slot-Notiz aus gassenturmAssignment -->
            <input
              v-if="slot.ch.gassenturmAssignment.notiz !== undefined"
              v-model="slot.ch.gassenturmAssignment.notiz"
              @input="emit('change')"
              placeholder="Aufbau-Notiz"
              class="w-full h-7 rounded border border-input bg-background px-2 text-sm text-muted-foreground/70 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>

        <!-- Neue Position -->
        <div class="border-t border-border/40">
          <div v-if="addingSlot !== tower.name" class="px-4 py-2">
            <button
              type="button"
              @click="startAddSlot(tower.name, tower.slots.length + 1)"
              class="text-xs text-accent hover:underline"
            >+ Position hinzufügen</button>
          </div>
          <div v-else class="flex items-center gap-2 px-4 py-2">
            <span class="text-xs text-muted-foreground shrink-0">Pos.</span>
            <input
              ref="addSlotInput"
              v-model.number="addSlotPos"
              type="number"
              min="1"
              placeholder="1"
              class="w-16 h-7 rounded border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              @keydown.enter.prevent="confirmAddSlot(tower.name)"
              @keydown.escape="addingSlot = null"
            />
            <button type="button" @click="confirmAddSlot(tower.name)" class="h-7 px-2 rounded bg-accent text-accent-foreground text-xs font-semibold hover:bg-accent/90">OK</button>
            <button type="button" @click="addingSlot = null" class="h-7 px-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60">Abbrechen</button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed, ref, nextTick, watch } from 'vue'

const props = defineProps({
  channels: { type: Array, required: true },
  towerMeta: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['updateTower', 'renameTower', 'addChannel', 'removeChannel', 'change'])

// Neuer Turm
const addingTower = ref(false)
const addName = ref('')
const addRichtung = ref('C')
const addNameInput = ref(null)

function confirmAdd() {
  const name = addName.value.trim()
  if (!name) return
  emit('updateTower', name, { richtung: addRichtung.value, notiz: '' })
  addingTower.value = false
  addName.value = ''
  addRichtung.value = 'C'
}

watch(addingTower, (val) => { if (val) nextTick(() => addNameInput.value?.focus()) })

// Neue Position pro Turm
const addingSlot = ref(null) // turmname oder null
const addSlotPos = ref(null)
const addSlotInput = ref(null)

function startAddSlot(turmname, nextPos) {
  addingSlot.value = turmname
  addSlotPos.value = nextPos
  nextTick(() => addSlotInput.value?.focus())
}

function confirmAddSlot(turmname) {
  const pos = Number(addSlotPos.value)
  if (!pos) return
  const taken = props.channels.some(ch =>
    ch.gassenturmAssignment?.turmname === turmname &&
    ch.gassenturmAssignment?.position === pos
  )
  if (taken) { alert(`Position ${pos} in „${turmname}" ist bereits belegt.`); return }
  emit('addChannel', { turmname, position: pos })
  addingSlot.value = null
  addSlotPos.value = null
}

function removeSlot(ch) {
  const label = ch.channel ? `Kanal ${ch.channel}` : `Position ${ch.gassenturmAssignment?.position}`
  if (!confirm(`${label} aus dem Gassenturm entfernen?`)) return
  emit('removeChannel', ch)
}

function updateMeta(turmname, field, value) {
  const current = props.towerMeta[turmname] ?? { richtung: 'C', notiz: '' }
  emit('updateTower', turmname, { ...current, [field]: value })
}

function renameTower(oldName, newName) {
  if (!newName || newName === oldName) return
  emit('renameTower', oldName, newName)
}

const COLOR_MAP = {
  'rot': '#ef4444', 'red': '#ef4444',
  'grün': '#22c55e', 'green': '#22c55e',
  'blau': '#3b82f6', 'blue': '#3b82f6',
  'gelb': '#eab308', 'yellow': '#eab308',
  'orange': '#f97316',
  'lila': '#a855f7', 'purple': '#a855f7',
  'pink': '#ec4899',
  'weiß': '#f8fafc', 'white': '#f8fafc',
  'schwarz': '#1e293b', 'black': '#1e293b',
  'cyan': '#06b6d4',
  'magenta': '#d946ef',
  'amber': '#f59e0b',
  'lime': '#84cc16',
}

function colorStyle(color) {
  if (!color) return {}
  const lower = color.toLowerCase().trim()
  const hex = COLOR_MAP[lower] || (lower.startsWith('#') ? lower : null)
  return hex ? { backgroundColor: hex } : { backgroundColor: '#94a3b8' }
}

const towers = computed(() => {
  const map = new Map()
  for (const ch of props.channels) {
    const a = ch.gassenturmAssignment
    if (!a?.turmname) continue
    if (!map.has(a.turmname)) map.set(a.turmname, [])
    map.get(a.turmname).push({ ch })
  }
  const result = []
  for (const [name, slots] of map) {
    result.push({
      name,
      slots: slots.sort((a, b) => (a.ch.gassenturmAssignment.position ?? 0) - (b.ch.gassenturmAssignment.position ?? 0))
    })
  }
  return result.sort((a, b) => a.name.localeCompare(b.name))
})
</script>
