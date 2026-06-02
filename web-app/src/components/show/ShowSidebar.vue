<template>
  <nav
    class="flex flex-col absolute left-0 top-0 bottom-0 z-30 border-r border-border overflow-y-auto bg-surface-raised transition-all duration-200 ease-in-out"
    :class="expanded ? 'w-56' : 'w-14'"
    @mouseenter="expanded = true"
    @mouseleave="expanded = false"
  >
    <div class="flex flex-col gap-0.5 p-2 pt-7">

      <!-- Gruppe: Allgemein -->
      <div class="mb-1 px-3 overflow-hidden transition-all duration-200" :class="expanded ? 'opacity-100 h-5' : 'opacity-0 h-0'">
        <span class="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-widest whitespace-nowrap">
          {{ labels.groupGeneral }}
        </span>
      </div>

      <!-- Kanäle -->
      <NavItem
        :active="activeTab === 'channels'"
        :expanded="expanded"
        :icon="ListIcon"
        @click="emit('navigate', { tab: 'channels' })"
      >
        {{ labels.channels }}
      </NavItem>

      <!-- Gruppe: Aufbauplan -->
      <div class="px-3 overflow-hidden transition-all duration-200" :class="expanded ? 'opacity-100 h-5 mt-6 mb-1' : 'opacity-0 h-0 mt-0 mb-0'">
        <span class="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-widest whitespace-nowrap">
          {{ labels.groupAufbau }}
        </span>
      </div>

      <NavItem
        v-if="showTowers"
        :active="activeTab === 'gassenturm' && activeSubTab === 'gassenturm'"
        :expanded="expanded"
        :icon="TowerIcon"
        @click="emit('navigate', { tab: 'gassenturm', subTab: 'gassenturm' })"
      >
        {{ labels.buehne }}
      </NavItem>

      <NavItem
        v-if="showBars"
        :active="activeTab === 'gassenturm' && activeSubTab === 'zugstangen'"
        :expanded="expanded"
        :icon="BarsIcon"
        @click="emit('navigate', { tab: 'gassenturm', subTab: 'zugstangen' })"
      >
        {{ labels.obermaschinerie }}
      </NavItem>

      <NavItem
        v-for="section in sortedSections"
        :key="section.id"
        :active="activeTab === 'gassenturm' && activeSubTab === `section:${section.id}`"
        :expanded="expanded"
        :icon="SectionIcon"
        @click="emit('navigate', { tab: 'gassenturm', subTab: `section:${section.id}` })"
      >
        {{ section.title || '(kein Titel)' }}
      </NavItem>

      <button
        class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground/60 hover:text-foreground hover:bg-white/5 transition-colors text-left overflow-hidden"
        @click="emit('addSection')"
      >
        <PlusIcon class="w-4 h-4 shrink-0" />
        <span class="whitespace-nowrap transition-all duration-200 overflow-hidden" :class="expanded ? 'opacity-100 max-w-xs' : 'opacity-0 max-w-0'">
          {{ labels.addSection }}
        </span>
      </button>

      <!-- Gruppe: Medien -->
      <div class="px-3 overflow-hidden transition-all duration-200" :class="expanded ? 'opacity-100 h-5 mt-6 mb-1' : 'opacity-0 h-0 mt-0 mb-0'">
        <span class="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-widest whitespace-nowrap">
          {{ labels.groupMedia }}
        </span>
      </div>

      <NavItem
        :active="activeTab === 'photos'"
        :expanded="expanded"
        :icon="PhotosIcon"
        @click="emit('navigate', { tab: 'photos' })"
      >
        {{ labels.photos }}
      </NavItem>

      <NavItem
        :active="activeTab === 'floorplan'"
        :expanded="expanded"
        :icon="FloorplanIcon"
        @click="emit('navigate', { tab: 'floorplan' })"
      >
        {{ labels.floorplan }}
      </NavItem>

    </div>
  </nav>
</template>

<script setup>
import { computed, defineComponent, h, ref } from 'vue'
import {
  List as ListIcon,
  Layers as TowerIcon,
  AlignJustify as BarsIcon,
  LayoutGrid as SectionIcon,
  Plus as PlusIcon,
  Image as PhotosIcon,
  Map as FloorplanIcon,
} from 'lucide-vue-next'

const expanded = ref(false)

const NavItem = defineComponent({
  props: { active: Boolean, expanded: Boolean, icon: Object },
  emits: ['click'],
  setup(props, { slots, emit }) {
    return () => h('button', {
      onClick: () => emit('click'),
      class: [
        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors overflow-hidden',
        props.active
          ? 'bg-accent/85 text-accent-foreground font-semibold'
          : 'text-foreground/85 hover:bg-accent/85 hover:text-accent-foreground'
      ].join(' ')
    }, [
      props.icon ? h(props.icon, { class: 'w-4 h-4 shrink-0' }) : null,
      h('span', {
        class: [
          'whitespace-nowrap transition-all duration-200 overflow-hidden',
          props.expanded ? 'opacity-100 max-w-xs' : 'opacity-0 max-w-0'
        ].join(' ')
      }, slots.default?.())
    ])
  }
})

const props = defineProps({
  activeTab: { type: String, default: 'gassenturm' },
  activeSubTab: { type: String, default: null },
  sectionDefs: { type: Array, default: () => [] },
  showBars: { type: Boolean, default: true },
  showTowers: { type: Boolean, default: true },
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
