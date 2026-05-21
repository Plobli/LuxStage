<template>
  <nav class="flex flex-col w-64 shrink-0 border-r border-border overflow-y-auto" style="background: hsl(240 10% 7%)">
    <div class="flex flex-col gap-0.5 p-4 pt-7">

      <!-- Gruppe: Allgemein -->
      <div class="mb-1 px-3 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-widest">
        {{ labels.groupGeneral }}
      </div>

      <!-- Kanäle -->
      <NavItem
        :active="activeTab === 'channels'"
        @click="emit('navigate', { tab: 'channels' })"
      >
        {{ labels.channels }}
      </NavItem>

      <!-- Gruppe: Aufbauplan -->
      <div class="mt-10 mb-1 px-3 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-widest">
        {{ labels.groupAufbau }}
      </div>

      <NavItem
        :active="activeTab === 'gassenturm' && activeSubTab === 'gassenturm'"
        @click="emit('navigate', { tab: 'gassenturm', subTab: 'gassenturm' })"
      >
        {{ labels.buehne }}
      </NavItem>

      <NavItem
        :active="activeTab === 'gassenturm' && activeSubTab === 'zugstangen'"
        @click="emit('navigate', { tab: 'gassenturm', subTab: 'zugstangen' })"
      >
        {{ labels.obermaschinerie }}
      </NavItem>

      <NavItem
        v-for="section in sortedSections"
        :key="section.id"
        :active="activeTab === 'gassenturm' && activeSubTab === `section:${section.id}`"
        @click="emit('navigate', { tab: 'gassenturm', subTab: `section:${section.id}` })"
      >
        {{ section.title || '(kein Titel)' }}
      </NavItem>

      <button
        class="flex items-center px-3 py-2 rounded-lg text-sm text-muted-foreground/60 hover:text-foreground hover:bg-white/5 transition-colors text-left"
        @click="emit('addSection')"
      >
        {{ labels.addSection }}
      </button>

      <!-- Gruppe: Medien -->
      <div class="mt-10 mb-1 px-3 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-widest">
        {{ labels.groupMedia }}
      </div>

      <NavItem
        :active="activeTab === 'photos'"
        @click="emit('navigate', { tab: 'photos' })"
      >
        {{ labels.photos }}
      </NavItem>

      <NavItem
        :active="activeTab === 'floorplan'"
        @click="emit('navigate', { tab: 'floorplan' })"
      >
        {{ labels.floorplan }}
      </NavItem>

    </div>
  </nav>
</template>

<script setup>
import { computed, defineComponent, h } from 'vue'


const NavItem = defineComponent({
  props: { active: Boolean },
  emits: ['click'],
  setup(props, { slots, emit }) {
    return () => h('button', {
      onClick: () => emit('click'),
      class: [
        'w-full flex items-center px-3 py-2 rounded-lg text-sm text-left transition-colors',
        props.active
          ? 'bg-accent/85 text-accent-foreground font-semibold'
          : 'text-foreground/85 hover:bg-accent/85 hover:text-accent-foreground'
      ].join(' ')
    }, slots.default?.())
  }
})

const props = defineProps({
  activeTab: { type: String, default: 'gassenturm' },
  activeSubTab: { type: String, default: null },
  sectionDefs: { type: Array, default: () => [] },
  labels: {
    type: Object,
    default: () => ({
      groupGeneral: 'Allgemein',
      channels: 'Kanäle',
      groupAufbau: 'Aufbauplan',
      buehne: 'Bühne',
      obermaschinerie: 'Obermaschinerie',
      groupMedia: 'Medien',
      photos: 'Fotos',
      floorplan: 'Grundriss',
      addSection: 'Abschnitt hinzufügen',
    })
  }
})

const emit = defineEmits(['navigate', 'addSection'])

const sortedSections = computed(() =>
  [...props.sectionDefs].sort((a, b) => a.order - b.order)
)
</script>
