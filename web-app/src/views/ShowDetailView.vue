<template>
  <div>
    <!-- Top Header -->
    <div class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-white/10 bg-gray-950 px-4 sm:px-6 lg:px-8">
      <button type="button" class="text-gray-400 hover:text-white" @click="router.push('/')">
        <span class="sr-only">{{ t('action.back') }}</span>
        <svg class="size-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clip-rule="evenodd" /></svg>
      </button>
      <div class="h-6 w-px bg-white/10" aria-hidden="true"></div>
      <!-- Tab-Switcher -->
      <div class="flex gap-1 mr-2">
        <button
          :class="mobileTab === 'channels' ? 'bg-white/10 text-white' : 'text-gray-400'"
          class="rounded px-2 py-1 text-xs font-medium"
          @click="mobileTab = 'channels'"
        >{{ t('tab.channels') }}</button>
        <button
          :class="mobileTab === 'info' ? 'bg-white/10 text-white' : 'text-gray-400'"
          class="rounded px-2 py-1 text-xs font-medium"
          @click="mobileTab = 'info'"
        >{{ t('tab.info') }}</button>
        <button
          :class="mobileTab === 'floorplan' ? 'bg-white/10 text-white' : 'text-gray-400'"
          class="rounded px-2 py-1 text-xs font-medium"
          @click="mobileTab = 'floorplan'"
        >{{ t('tab.floorplan') }}</button>
      </div>
      <div class="flex min-w-0 flex-1 items-center gap-x-3">
        <h1 class="text-sm font-semibold text-white truncate">{{ meta.name }}</h1>
        <span class="hidden sm:block text-xs text-gray-500 shrink-0">{{ meta.datum }}</span>
        <!-- Undo/Redo -->
        <button
          type="button"
          :disabled="!canUndo"
          :class="canUndo ? 'text-gray-400 hover:text-white' : 'opacity-30 cursor-not-allowed pointer-events-none'"
          class="no-print p-1"
          :title="t('action.undo')"
          @click="undo()"
        >
          <ArrowUturnLeftIcon class="size-4" />
        </button>
        <button
          type="button"
          :disabled="!canRedo"
          :class="canRedo ? 'text-gray-400 hover:text-white' : 'opacity-30 cursor-not-allowed pointer-events-none'"
          class="no-print p-1"
          :title="t('action.redo')"
          @click="redo()"
        >
          <ArrowUturnRightIcon class="size-4" />
        </button>
        <span v-if="channelsSaving || sectionsSaving || setupSaving" class="text-xs text-gray-500 shrink-0">…</span>
      </div>
      <!-- Suchfeld rechtsbündig -->
      <div class="flex items-center gap-x-3 shrink-0">
        <!-- Presence: aktive Nutzer -->
        <div v-if="presence.length > 1" class="flex items-center -space-x-1.5">
          <div
            v-for="u in presence.slice(0, 4)"
            :key="u.username"
            :title="u.username + (u.devices.includes('ios') ? ' (iOS)' : '')"
            class="size-6 rounded-full bg-gray-700 ring-2 ring-gray-950 flex items-center justify-center text-[10px] font-semibold text-white uppercase"
          >{{ u.username[0] }}</div>
          <div v-if="presence.length > 4" class="size-6 rounded-full bg-gray-700 ring-2 ring-gray-950 flex items-center justify-center text-[9px] text-gray-400">+{{ presence.length - 4 }}</div>
        </div>
        <span v-if="dupWarning" class="text-xs text-yellow-400">⚠ {{ t('channel.dup_address') }}</span>
        <span v-if="dupChannelWarning" class="text-xs text-yellow-400">⚠ {{ t('channel.dup_channel') }}</span>
        <div class="grid grid-cols-1">
          <input
            v-model="search"
            type="search"
            :placeholder="t('channel.search')"
            class="col-start-1 row-start-1 block w-28 xl:w-48 bg-white/5 py-1.5 pr-3 pl-9 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent rounded-md placeholder:text-gray-500"
          />
          <MagnifyingGlassIcon class="pointer-events-none col-start-1 row-start-1 ml-3 size-4 self-center text-gray-400" aria-hidden="true" />
        </div>
      </div>
      <div class="h-6 w-px bg-white/10 shrink-0" aria-hidden="true"></div>
      <!-- Buttons -->
      <div class="no-print flex items-center gap-x-2 shrink-0">

        <!-- Verlauf -->
        <button type="button" class="rounded-md px-2 py-1.5 text-sm font-semibold text-gray-400 ring-1 ring-white/10 hover:ring-white/20" @click="openHistory">{{ t('history.btn') }}</button>

        <!-- Importieren Dropdown -->
        <div class="relative">
          <button
            type="button"
            :class="menuOpen === 'import' ? 'ring-white/30 text-white' : 'ring-white/10 text-gray-400'"
            class="rounded-md px-2 py-1.5 text-sm font-semibold ring-1 hover:ring-white/30 flex items-center gap-1"
            @click="menuOpen = menuOpen === 'import' ? null : 'import'"
          >
            {{ t('nav.import') }}
            <svg class="size-3 opacity-50" viewBox="0 0 12 12" fill="currentColor"><path d="M6 8L1 3h10z"/></svg>
          </button>
          <div
            v-if="menuOpen === 'import'"
            class="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg bg-gray-950 ring-1 ring-white/15 shadow-2xl overflow-hidden"
          >
            <OcrImport class="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-white/8 block" @click.stop @dialog-open="ocrDialogOpen = true" @dialog-close="ocrDialogOpen = false; menuOpen = null" @import="onOcrImport" />
            <button class="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-white/8" @click="eosFileInput?.click(); menuOpen = null">{{ t('eos.import.button') }}</button>
            <div class="border-t border-white/10" />
            <button class="w-full text-left px-4 py-2.5 text-sm text-gray-500 hover:bg-white/8" @click="csvImportInput?.click(); menuOpen = null">{{ t('channel.import') }}</button>
          </div>
        </div>

        <!-- Exportieren Dropdown -->
        <div class="relative">
          <button
            type="button"
            :class="menuOpen === 'export' ? 'ring-white/30 text-white' : 'ring-white/10 text-gray-400'"
            class="rounded-md px-2 py-1.5 text-sm font-semibold ring-1 hover:ring-white/30 flex items-center gap-1"
            @click="menuOpen = menuOpen === 'export' ? null : 'export'"
          >
            {{ t('nav.export') }}
            <svg class="size-3 opacity-50" viewBox="0 0 12 12" fill="currentColor"><path d="M6 8L1 3h10z"/></svg>
          </button>
          <div
            v-if="menuOpen === 'export'"
            class="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg bg-gray-950 ring-1 ring-white/15 shadow-2xl overflow-hidden"
            @click="menuOpen = null"
          >
            <button class="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-white/8" @click="openPdf">{{ t('show.pdf') }}</button>
            <div class="border-t border-white/10" />
            <button class="w-full text-left px-4 py-2.5 text-sm text-gray-500 hover:bg-white/8" @click="downloadChannelsCsv(props.id, channels)">{{ t('channel.export') }}</button>
          </div>
        </div>

      </div>
      <!-- Klick außerhalb schließt Dropdown (nicht wenn OCR-Dialog offen) -->
      <div v-if="menuOpen && !ocrDialogOpen" class="fixed inset-0 z-40" @click="menuOpen = null" />
      <input ref="csvImportInput" type="file" accept=".csv" class="hidden" @change="onCsvImportSelected" />
      <input ref="eosFileInput" type="file" accept=".csv" class="hidden" @change="onEosFileSelected" />
    </div>

    <div v-if="loading" class="flex items-center justify-center h-64 text-sm text-gray-400">…</div>

    <div v-else :inert="!isOnline || undefined" :class="{ 'opacity-40 pointer-events-none select-none': !isOnline }">
      <!-- Two-column layout: aside + main -->
      <div :class="mobileTab !== 'channels' && mobileTab !== 'info' ? 'hidden' : mobileTab !== 'channels' ? 'hidden xl:block' : ''" class="xl:pl-[28rem] xl:ml-0">
        <!-- Main: Kanaltabelle -->
        <main class="px-4 py-6 sm:px-6 lg:px-8">
          <div class="flex items-center gap-3 mb-4">
            <SectionHeading :text="t('show.channels')" class="flex-1 min-w-0" />
            <span class="text-xs text-gray-500 shrink-0">{{ totalVisible }} / {{ channels.length }}</span>
          </div>
          <div>
            <table class="min-w-full overflow-x-auto">
              <colgroup>
                <col class="w-4" />            <!-- Handle -->
                <col class="w-24" />           <!-- Kanal + Adresse -->
                <col class="w-20" />           <!-- Farbe -->
                <col class="w-[30ch]" />       <!-- Gerät -->
                <col />                        <!-- Notizen (rest) -->
                <col class="w-6" />            <!-- Löschen -->
              </colgroup>
              <thead class="sticky top-16 z-10 bg-gray-950">
                <tr class="border-b border-white/10">
                  <th class="w-4"></th>
                  <th scope="col" class="py-3 pr-3 pl-0 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{{ t('field.channel') }}</th>
                  <th scope="col" class="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{{ t('field.color') }}</th>
                  <th scope="col" class="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{{ t('field.device') }}</th>
                  <th scope="col" class="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{{ t('field.notes') }}</th>
                  <th scope="col" class="w-6"></th>
                </tr>
              </thead>
              <tbody ref="sortableTbody">
                <template v-for="group in groupedChannels" :key="group.position">
                  <!-- Gruppen-Header (nicht sortierbar) -->
                  <tr class="border-t border-white/5" data-no-drag :data-pos="group.position">
                    <th colspan="6" scope="colgroup" class="py-2 pr-3 pl-0 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      <template v-if="editingPosition === group.position">
                        <input
                          v-model="editingPositionValue"
                          autofocus
                          @blur="savePosition"
                          @keydown.enter="savePosition"
                          @keydown.escape="editingPosition = null"
                          class="bg-transparent border-b border-accent focus:outline-none text-xs font-semibold text-white uppercase tracking-wide w-40"
                        />
                      </template>
                      <template v-else>
                        <button
                          type="button"
                          class="hover:text-white transition-colors"
                          :title="t('channel.position.edit')"
                          @click="startEditPosition(group.position)"
                        >
                          {{ group.position || t('channel.no_category') }}
                        </button>
                        <span class="ml-2 font-normal normal-case text-gray-600">{{ group.channels.length }}</span>
                      </template>
                    </th>
                  </tr>
                  <!-- Kanal-Zeilen -->
                  <tr
                    v-for="ch in group.channels"
                    :key="ch.channel"
                    :data-ch-key="ch.channel + '|' + ch.address"
                    :data-ch-pos="group.position"
                    :data-nav-row="rowIndexOf(ch)"
                    class="border-t border-white/5 group/row hover:bg-white/[0.03] transition-colors align-middle"
                  >
                    <td class="py-2 pr-0 pl-0 align-middle w-4">
                      <div class="drag-handle no-print cursor-grab active:cursor-grabbing px-1 text-gray-400 hover:text-gray-200 transition-colors">
                        <svg class="size-4" viewBox="0 0 20 20" fill="currentColor"><path d="M7 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM7 10a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM7 16a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM13 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM13 10a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM13 16a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>
                      </div>
                    </td>
                    <td class="py-2 pr-3 pl-0 align-middle">
                      <div
                        class="flex flex-col items-center gap-1 cursor-pointer select-none"
                        @click.stop="toggleChannelStatus(ch)"
                      >
                        <input
                          v-model="ch.channel"
                          @focus="recordFocus()"
                          @input="persistChannels()"
                          @blur="commitFocus()"
                          :data-nav-row="rowIndexOf(ch)"
                          data-nav-col="0"
                          @keydown="onKeydown($event, rowIndexOf(ch), 0, 4, () => startAdd(ch.position))"
                          :class="[dupChannelNrs.has(ch.channel) ? 'ring-1 ring-yellow-400/60 rounded' : '', channelStatus(ch) === 'active' ? 'text-green-400' : channelStatus(ch) === 'eos' ? 'text-amber-400' : 'text-gray-400']"
                          class="bg-transparent focus:bg-white/5 focus:outline-none focus:ring-0 text-2xl font-bold font-mono px-0 border-0 leading-none w-[4ch] text-center"
                        />
                        <input
                          v-model="ch.address"
                          @focus="recordFocus()"
                          @input="persistChannels()"
                          @blur="commitFocus()"
                          class="bg-transparent focus:bg-white/5 focus:outline-none focus:ring-0 text-xs text-gray-500 px-0 border-0 w-[5ch] text-center"
                        />
                      </div>
                    </td>
                    <td class="px-3 py-2 align-middle">
                      <ColorAutocomplete
                        :modelValue="ch.color"
                        @update:modelValue="pushSnapshot(); ch.color = $event; persistChannels()"
                        :placeholder="t('field.color')"
                        :inputAttrs="{ 'data-nav-row': rowIndexOf(ch), 'data-nav-col': 1 }"
                        @keydown="onKeydown($event, rowIndexOf(ch), 1, 4, null)"
                      />
                    </td>
                    <td class="px-3 py-0 align-middle">
                      <textarea
                        v-model="ch.device"
                        @focus="recordFocus()"
                        @input="persistChannels()"
                        @blur="commitFocus()"
                        :data-nav-row="rowIndexOf(ch)"
                        data-nav-col="2"
                        @keydown="onKeydown($event, rowIndexOf(ch), 2, 4, null)"
                        class="bg-white/[0.04] focus:bg-white/[0.07] focus:outline-none focus:ring-0 text-sm text-gray-300 w-full px-2 border-0 resize-none leading-snug [field-sizing:content] min-h-14 py-4 align-middle rounded"
                      />
                    </td>
                    <td class="px-3 py-0 align-middle">
                      <textarea
                        v-model="ch.notes"
                        @focus="recordFocus()"
                        @input="persistChannels()"
                        @blur="commitFocus()"
                        :data-nav-row="rowIndexOf(ch)"
                        data-nav-col="3"
                        @keydown="onKeydown($event, rowIndexOf(ch), 3, 4, () => startAdd(ch.position))"
                        class="bg-white/[0.04] focus:bg-white/[0.07] focus:outline-none focus:ring-0 text-sm text-gray-300 w-full px-2 border-0 resize-none leading-snug [field-sizing:content] min-h-14 py-4 align-middle rounded"
                      />
                    </td>
                    <td class="pl-2 pr-1" style="vertical-align: middle; text-align: center;">
                      <button class="no-print text-gray-400 hover:text-red-400 transition-colors" @click="deleteChannel(ch)" :title="t('action.delete')">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                      </button>
                    </td>
                  </tr>
                  <!-- Zeile hinzufügen -->
                  <tr class="no-print border-t border-white/5" data-no-drag>
                    <td colspan="6" class="py-2 pl-0">
                      <button type="button" class="text-sm text-gray-600 hover:text-gray-300" @click="startAdd(group.position)">+ {{ t('channel.add') }}</button>
                    </td>
                  </tr>
                  <tr v-if="addingPosition === group.position" class="border-t border-white/5 bg-white/5" data-no-drag @keydown.escape="addingPosition = null" @keydown.enter.prevent="saveAdd">
                    <td class="w-4"></td>
                    <td class="py-2 pr-3 pl-0 align-middle">
                      <div class="flex flex-col items-center gap-1">
                        <input autofocus class="bg-transparent focus:outline-none text-2xl font-bold font-mono text-white px-0 border-0 leading-none w-[4ch] text-center" v-model="addForm.channel" :placeholder="t('show.channel.nr')" />
                        <input class="bg-transparent focus:outline-none text-xs text-gray-500 px-0 border-0 w-[5ch] text-center" v-model="addForm.address" :placeholder="t('show.channel.address.example')" />
                      </div>
                    </td>
                    <td class="px-3 py-2 align-middle">
                      <ColorAutocomplete v-model="addForm.color" @change="() => {}" :placeholder="t('field.color')" />
                    </td>
                    <td class="px-3 py-0 align-middle"><textarea class="bg-transparent focus:outline-none text-sm text-gray-300 w-full px-2 border-0 resize-none leading-snug [field-sizing:content] min-h-14 py-4 align-middle" v-model="addForm.device" /></td>
                    <td class="px-3 py-0 align-middle"><textarea class="bg-transparent focus:outline-none text-sm text-gray-300 w-full px-2 border-0 resize-none leading-snug [field-sizing:content] min-h-14 py-4 align-middle" v-model="addForm.notes" /></td>
                    <td class="py-2 pl-2 pr-0 align-middle"><button class="text-green-400 hover:text-green-300 text-sm" @click="saveAdd">✓</button></td>
                  </tr>
                </template>
              </tbody>
              <tbody v-if="groupedChannels.length === 0">
                <tr v-if="addingPosition === ''" class="border-t border-white/5 bg-white/5" @keydown.escape="addingPosition = null" @keydown.enter.prevent="saveAdd">
                  <td class="w-4"></td>
                  <td class="py-2 pr-3 pl-0 align-middle">
                    <div class="flex flex-col items-center gap-1">
                      <input autofocus class="bg-transparent focus:outline-none text-2xl font-bold font-mono text-white px-0 border-0 leading-none w-[4ch] text-center" v-model="addForm.channel" :placeholder="t('show.channel.nr')" />
                      <input class="bg-transparent focus:outline-none text-xs text-gray-500 px-0 border-0 w-[5ch] text-center" v-model="addForm.address" :placeholder="t('show.channel.address.example')" />
                    </div>
                  </td>
                  <td class="px-3 py-2 align-middle">
                    <ColorAutocomplete
                      v-model="addForm.color"
                      @change="() => {}"
                      :placeholder="t('field.color')"
                    />
                  </td>
                  <td class="px-3 py-0 align-middle"><textarea class="bg-transparent focus:outline-none text-sm text-gray-300 w-full px-2 border-0 resize-none leading-snug [field-sizing:content] min-h-14 py-4 align-middle" v-model="addForm.device" /></td>
                  <td class="px-3 py-0 align-middle"><textarea class="bg-transparent focus:outline-none text-sm text-gray-300 w-full px-2 border-0 resize-none leading-snug [field-sizing:content] min-h-14 py-4 align-middle" v-model="addForm.notes" /></td>
                  <td class="py-2 pl-2 pr-0 align-middle"><button class="text-green-400 hover:text-green-300 text-sm" @click="saveAdd">✓</button></td>
                </tr>
                <tr v-else class="border-t border-white/5">
                  <td colspan="6" class="py-4 pl-0">
                    <span class="text-sm text-gray-500">{{ t('channel.list.empty') }}</span>
                    <button type="button" class="ml-3 text-sm text-gray-400 hover:text-white" @click="startAdd('')">+ {{ t('channel.add') }}</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </main>
      </div>

      <!-- Grundriss-Tab -->
      <div v-if="mobileTab === 'floorplan'" class="h-[calc(100vh-4rem)]">
        <FloorplanEditor
          :image-url="floorplan.image_url ? api.url(floorplan.image_url) : null"
          :initial-svg-data="floorplan.svg_data"
          :channels="channels"
          @change="onFloorplanChange"
          @jump-to-channel="jumpToChannel"
        />
      </div>

      <!-- Aside: Sections + Fotos (fixed, left of main) -->
      <aside :class="mobileTab === 'floorplan' ? 'hidden' : mobileTab !== 'info' ? 'hidden xl:block' : ''" class="xl:fixed xl:top-16 xl:bottom-0 xl:left-20 xl:w-[28rem] xl:overflow-y-auto xl:border-r xl:border-white/10 px-4 py-6 sm:px-6 border-b border-white/10 xl:border-b-0">

        <!-- Sections (inline editor) -->
        <div ref="sortableSections" class="space-y-6 mb-6">
          <section
            v-for="sec in sortedSections"
            :key="sec.id"
            :data-section-id="sec.id"
            class="group/sec mb-8"
          >
            <!-- Section header -->
            <div class="flex items-center mb-4">
              <input
                :value="sec.title"
                :placeholder="t('sections.title.placeholder')"
                @input="sec.title = $event.target.value"
                @change="persistSectionDefs"
                class="pr-3 text-lg font-semibold text-accent bg-gray-950 shrink-0 border-0 focus:outline-none min-w-0 placeholder:text-accent/40"
                :size="Math.max((sec.title || t('sections.title.placeholder')).length, 4)"
              />
              <div class="flex-1 border-t border-accent/40"></div>
              <span class="section-drag-handle cursor-grab text-gray-400 hover:text-gray-200 transition-colors shrink-0 pl-3">
                <svg class="size-4" viewBox="0 0 20 20" fill="currentColor"><path d="M7 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM7 10a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM7 16a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM13 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM13 10a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM13 16a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>
              </span>
              <button class="text-gray-400 hover:text-red-400 shrink-0 transition-colors pl-2" @click="deleteSectionDef(sortedSections.indexOf(sec))">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <!-- Fields section -->
            <div v-if="sec.type === 'fields'">
              <div
                :data-fields-sortable="sec.id"
                class="divide-y divide-white/5 mb-2"
              >
                <div
                  v-for="(field, fidx) in sec.fields"
                  :key="field.key"
                  class="flex items-center h-[40px] gap-2 group/field"
                >
                  <span class="field-drag-handle cursor-grab text-gray-400 hover:text-gray-200 transition-colors shrink-0">
                    <svg class="size-4" viewBox="0 0 20 20" fill="currentColor"><path d="M7 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM7 10a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM7 16a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM13 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM13 10a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM13 16a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>
                  </span>
                  <label class="w-28 text-sm text-gray-500 shrink-0">
                    <input
                      :value="field.label"
                      :placeholder="t('sections.field.label')"
                      @input="field.label = $event.target.value"
                      @change="persistSectionDefs"
                      class="w-full bg-transparent border-0 text-sm text-gray-400 focus:text-white focus:outline-none placeholder:text-gray-600"
                    />
                  </label>
                  <input
                    :value="parseFieldValue(sec.id, field.key)"
                    @change="onFieldChange(sec.id, field.key, $event.target.value)"
                    class="flex-1 bg-transparent border-0 border-b border-white/10 focus:border-accent focus:outline-none text-sm text-white h-full px-2 transition-colors"
                  />
                  <button class="text-gray-400 hover:text-red-400 shrink-0 transition-colors" @click="deleteFieldDef(sec, fidx)">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
              <button class="text-xs text-gray-500 hover:text-white" @click="addFieldDef(sec)">{{ t('sections.field.add') }}</button>
            </div>

            <!-- Markdown/Textfeld section -->
            <MarkdownEditor
              v-else
              :modelValue="sectionContents.get(sec.id) ?? ''"
              @update:modelValue="onSectionChange(sec.id, $event)"
            />
          </section>
        </div>

        <!-- Fallback: single setup editor (when no sections defined) -->
        <section v-if="sortedSections.length === 0" class="mb-8">
          <SectionHeading :text="t('show.setup')" class="mb-4" />
          <MarkdownEditor v-model="setupMarkdown" @update:modelValue="onSetupChange" />
        </section>

        <!-- Add section buttons -->
        <div class="flex items-center gap-2 mb-6 py-2 border-t border-white/10">
          <button class="cursor-pointer text-sm text-gray-500 hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors" @click="addMarkdownSection">{{ t('sections.add.markdown') }}</button>
          <button v-if="!hasFieldsType()" class="cursor-pointer text-sm text-gray-500 hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors" @click="addFieldsSection">{{ t('sections.add.fields') }}</button>
        </div>

        <!-- Foto-Galerie -->
        <section>
          <div class="flex items-center gap-3 mb-4">
            <SectionHeading :text="t('show.photos')" class="flex-1 min-w-0" />
            <label class="cursor-pointer text-sm text-gray-400 hover:text-white shrink-0">
              + {{ t('photo.add') }}
              <input type="file" accept="image/*" multiple class="sr-only" @change="onFileInput" />
            </label>
          </div>
          <div v-if="uploadQueue.length > 0" class="mb-3 space-y-1">
            <div v-for="item in uploadQueue" :key="item.name" class="flex items-center gap-2">
              <div class="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all"
                  :class="item.error ? 'bg-red-500' : item.done ? 'bg-green-500' : 'bg-accent'"
                  :style="{ width: item.progress + '%' }"
                />
              </div>
              <span class="text-xs text-gray-500 w-8 text-right">{{ item.done ? '✓' : item.error ? '✗' : item.progress + '%' }}</span>
            </div>
          </div>
          <div
            :class="{ 'ring-2 ring-accent ring-inset rounded-lg': dragging }"
            @dragover.prevent="dragging = true"
            @dragleave="dragging = false"
            @drop.prevent="onDrop"
          >
            <p v-if="photos.length === 0 && !dragging" class="text-sm text-gray-500">{{ t('photo.empty') }}</p>
            <ul role="list" class="grid grid-cols-3 gap-2">
              <li v-for="filename in photos" :key="filename" class="relative group flex flex-col gap-1">
                <div class="aspect-square block w-full overflow-hidden rounded-lg bg-gray-800 cursor-pointer" @click="openLightbox(filename)">
                  <img :src="getPhotoUrl(props.id, filename)" :alt="filename" class="pointer-events-none object-cover group-hover:opacity-75 w-full h-full" />
                </div>
                <button
                  type="button"
                  class="absolute top-1 right-1 rounded bg-black/60 px-1 py-0.5 text-xs text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                  @click="onDeletePhoto(filename)"
                  :title="t('action.delete')"
                >✕</button>
                <input
                  type="text"
                  :value="photoCaptions[filename]?.caption ?? ''"
                  :placeholder="t('photo.caption.placeholder')"
                  class="w-full rounded bg-white/5 px-2 py-1 text-xs text-gray-300 placeholder-gray-600 border border-transparent focus:border-white/20 focus:outline-none"
                  @blur="onCaptionBlur(filename, $event)"
                  @keydown.enter="$event.target.blur()"
                />
                <div class="flex items-center gap-1 mt-1">
                  <span class="text-xs text-gray-600 shrink-0">Kanal:</span>
                  <input
                    type="text"
                    :value="photoCaptions[filename]?.channelNumber ?? ''"
                    placeholder="z. B. 42"
                    class="w-full rounded bg-white/5 px-2 py-1 text-xs text-gray-300 placeholder-gray-600 border border-transparent focus:border-white/20 focus:outline-none"
                    @blur="onChannelNumberBlur(filename, $event)"
                    @keydown.enter="$event.target.blur()"
                  />
                </div>
              </li>
            </ul>
          </div>
        </section>
      </aside>
    </div>

    <!-- Foto-Druckseiten (nur beim Drucken sichtbar) -->
    <div v-if="photos.length > 0" class="photo-print-pages">
      <div
        v-for="(page, pageIdx) in photoPages"
        :key="pageIdx"
        class="photo-print-page"
      >
        <div class="photo-print-grid" :data-cols="photoCols">
          <div v-for="filename in page" :key="filename" class="photo-print-item">
            <img :src="getPhotoUrl(props.id, filename)" :alt="photoCaptions[filename]?.caption || filename" />
            <p v-if="photoCaptions[filename]?.caption" class="photo-print-caption">{{ photoCaptions[filename].caption }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Lightbox -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="lightboxPhoto"
        class="fixed inset-0 z-50 flex flex-col items-center justify-center"
        @click="lightboxPhoto = null"
      >
        <!-- Blurred background -->
        <div class="absolute inset-0 backdrop-blur-xl bg-black/70" />

        <!-- Prev button -->
        <button
          v-if="lightboxIndex > 0"
          class="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-white/70 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-2 transition-colors"
          @click.stop="lightboxStep(-1)"
          aria-label="Vorheriges Foto"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </button>

        <!-- Image -->
        <img
          :src="getPhotoUrl(props.id, lightboxPhoto)"
          class="relative max-h-[85vh] max-w-[90vw] object-contain drop-shadow-2xl"
          @click.stop
        />

        <!-- Caption -->
        <p
          v-if="photoCaptions[lightboxPhoto]?.caption"
          class="relative mt-3 text-sm text-gray-300 max-w-lg text-center px-4"
          @click.stop
        >{{ photoCaptions[lightboxPhoto].caption }}</p>

        <!-- Next button -->
        <button
          v-if="lightboxIndex < photos.length - 1"
          class="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-white/70 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-2 transition-colors"
          @click.stop="lightboxStep(1)"
          aria-label="Nächstes Foto"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
        </button>

        <!-- Close button -->
        <button
          class="absolute top-3 right-3 z-10 text-white/70 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-1.5 transition-colors"
          @click.stop="lightboxPhoto = null"
          aria-label="Schließen"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
    </Transition>

    <!-- History Slide-Over -->
    <Transition
      enter-active-class="transition-transform duration-300 ease-out"
      enter-from-class="translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform duration-200 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="translate-x-full"
    >
      <div
        v-if="historyOpen"
        class="fixed inset-y-0 right-0 z-50 w-96 bg-gray-900 border-l border-white/10 flex flex-col shadow-2xl no-print"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <div class="flex items-center gap-2">
            <button
              v-if="historyEntry"
              type="button"
              class="text-xs text-gray-400 hover:text-white"
              @click="historyEntry = null"
            >
              {{ t('history.back') }}
            </button>
            <h2 class="text-sm font-semibold text-white">{{ t('history.title') }}</h2>
          </div>
          <button type="button" class="text-gray-400 hover:text-white" @click="historyOpen = false">
            <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Loading -->
        <div v-if="historyLoading" class="flex-1 flex items-center justify-center text-gray-500 text-sm">
          …
        </div>

        <!-- Snapshot list -->
        <div v-else-if="!historyEntry" class="flex-1 overflow-y-auto">
          <p v-if="historyList.length === 0" class="px-4 py-6 text-sm text-gray-500">{{ t('history.empty') }}</p>
          <button
            v-for="entry in historyList"
            :key="entry.id"
            type="button"
            class="w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors"
            @click="loadHistoryEntry(entry.id)"
          >
            <p class="text-sm text-white">{{ new Date(entry.created_at).toLocaleString() }}</p>
          </button>
        </div>

        <!-- Snapshot detail -->
        <div v-else class="flex-1 flex flex-col overflow-hidden">
          <div class="px-4 py-2 border-b border-white/5 shrink-0">
            <p class="text-xs text-gray-400">{{ new Date(historyEntry.created_at).toLocaleString() }}</p>
            <p class="text-xs text-gray-500 mt-0.5">{{ t('history.channel_count', { n: historyEntry.channels?.length ?? 0 }) }}</p>
          </div>
          <div class="flex-1 overflow-y-auto">
            <div
              v-for="ch in historyEntry.channels"
              :key="ch.id"
              class="flex items-baseline gap-3 px-4 py-2 border-b border-white/5 text-xs"
            >
              <span class="font-mono font-bold text-white w-8 shrink-0">{{ ch.channel }}</span>
              <span class="text-gray-400 truncate">{{ ch.device }}</span>
              <span class="text-gray-600 truncate ml-auto">{{ ch.notes }}</span>
            </div>
          </div>
          <div class="px-4 py-3 border-t border-white/10 shrink-0">
            <button
              type="button"
              class="w-full rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
              @click="doRestoreHistory"
            >
              {{ t('history.restore') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- History backdrop -->
    <div
      v-if="historyOpen"
      class="fixed inset-0 z-40 bg-black/40 no-print"
      @click="historyOpen = false"
    />

    <!-- EOS Merge Vorschau -->
    <EosMergePreviewDialog
      :open="eosMergePreview.open"
      :newActive="eosMergePreview.newActive"
      :nowGone="eosMergePreview.nowGone"
      :untouched="eosMergePreview.untouched"
      @confirm="resolveEosMergePreview(true)"
      @cancel="resolveEosMergePreview(false)"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useLocale } from '../composables/useLocale.js'
import { useConfirm } from '../composables/useConfirm.js'
import { useKeyboardNav } from '../composables/useKeyboardNav.js'
import MarkdownEditor from '../components/MarkdownEditor.vue'
import SectionHeading from '../components/SectionHeading.vue'
import { MagnifyingGlassIcon } from '@heroicons/vue/20/solid'
import { ArrowUturnLeftIcon, ArrowUturnRightIcon } from '@heroicons/vue/24/outline'
import { useUndoRedo } from '../composables/useUndoRedo.js'
import { fetchShow, updateMeta, fetchHistory, fetchHistoryEntry, restoreHistory, createSnapshot } from '../api/shows.js'
import { fetchChannels, saveChannels, downloadChannelsCsv, parseChannelsCsv, mergeChannels } from '../api/channels.js'
import { fetchPhotos, uploadPhoto, deletePhoto, getPhotoUrl, fetchPhotoCaptions, savePhotoCaption } from '../api/photos.js'
import { subscribeShow, isOnline } from '../api/client.js'
import { api } from '../api/client.js'
import { fetchShowSections, saveShowSections, fetchShowSectionDefs, saveShowSectionDefs } from '../api/sections.js'
import { uuid } from '../utils/uuid.js'
import { usePhotoSettings } from '../composables/usePhotoSettings.js'
import ColorAutocomplete from '../components/ColorAutocomplete.vue'
import OcrImport from '../components/OcrImport.vue'
import EosMergePreviewDialog from '../components/EosMergePreviewDialog.vue'
import FloorplanEditor from '../components/FloorplanEditor.vue'
import { fetchShowFloorplan, saveShowFloorplan } from '../api/floorplan.js'
import Sortable from 'sortablejs'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()
const { t } = useLocale()
const { confirm } = useConfirm()
const { onKeydown } = useKeyboardNav()
const { photosPerPage } = usePhotoSettings()

// Fotos gruppiert nach Seiten für den Druck
const photoPages = computed(() => {
  const n = photosPerPage.value
  const pages = []
  for (let i = 0; i < photos.value.length; i += n) {
    pages.push(photos.value.slice(i, i + n))
  }
  return pages
})

// Grid-Spalten je nach Anzahl Fotos pro Seite
const photoCols = computed(() => {
  const n = photosPerPage.value
  if (n === 1) return 1
  if (n === 2) return 2
  if (n <= 4) return 2
  if (n <= 6) return 3
  return 3 // 8, 9, 12
})

// ── State ──────────────────────────────────────────────────────────────────
const loading = ref(true)
const meta = ref({})          // frontmatter: name, datum, venue, …
const setupMarkdown = ref('') // Aufbau-Abschnitt aus .md-Datei
const eosActiveChannels = ref(null) // null = noch kein Import; Array<string> (neg. Prefix = inaktiv)
const eosMergePreview = ref({ open: false, newActive: [], nowGone: [], untouched: [] })
let _eosMergeResolve = null
const channels = ref([])
const photos = ref([])

const sortableTbody = ref(null)
const eosFileInput = ref(null)
const csvImportInput = ref(null)
const historyOpen = ref(false)
const historyList = ref([])
const historyEntry = ref(null)      // selected snapshot detail
const historyLoading = ref(false)
const search = ref('')
const setupSaving = ref(false)
const channelsSaving = ref(false)

const mobileTab = ref('channels') // 'channels' | 'info' | 'floorplan'
const menuOpen = ref(null) // 'import' | 'export' | null
const ocrDialogOpen = ref(false)

const floorplan = ref({ image_url: null, svg_data: null })
let floorplanSaveTimer = null

const sectionDefs = ref([])
const sectionContents = ref(new Map())
const sectionsSaving = ref(false)
const sortableSections = ref(null)
let saveSectionsTimer = null

// ── Undo/Redo ──────────────────────────────────────────────────────────────
const { initSnapshot, recordFocus, commitFocus, pushSnapshot, undo, redo, canUndo, canRedo } =
  useUndoRedo(
    // getState
    () => ({
      channels: channels.value,
      sectionContents: [...sectionContents.value.entries()],
      sectionDefs: sectionDefs.value,
      meta: meta.value,
      setupMarkdown: setupMarkdown.value,
    }),
    // applyState
    (snap) => {
      channels.value = snap.channels
      sectionContents.value = new Map(snap.sectionContents)
      sectionDefs.value = snap.sectionDefs
      meta.value = snap.meta
      setupMarkdown.value = snap.setupMarkdown
    },
    // cancelPendingSaves
    () => {
      clearTimeout(channelsSaveTimer); channelsSaveTimer = null
      clearTimeout(saveSetupTimer);    saveSetupTimer = null
      clearTimeout(saveSectionsTimer); saveSectionsTimer = null
    },
    // saveNow
    () => {
      persistChannels()
      persistSetup(setupMarkdown.value)
      persistSections()
    },
    // storageKey
    `undoredo-${props.id}`
  )

function onUndoRedoKeydown(e) {
  const focused = document.activeElement
  const isEditing = focused && (
    focused.tagName === 'INPUT' ||
    focused.tagName === 'TEXTAREA' ||
    focused.isContentEditable
  )
  if (isEditing) return

  const isMac = navigator.userAgentData?.platform === 'macOS' || /Mac/.test(navigator.userAgent)
  const mod = isMac ? e.metaKey : e.ctrlKey

  if (mod && !e.shiftKey && e.key === 'z') {
    e.preventDefault()
    undo()
  } else if (
    (mod && e.shiftKey && e.key === 'z') ||
    (mod && e.shiftKey && e.key === 'Z') ||
    (!isMac && mod && e.key === 'y')
  ) {
    e.preventDefault()
    redo()
  }
}

// ── Position-Bearbeitung ───────────────────────────────────────────────────────
const editingPosition = ref(null)
const editingPositionValue = ref('')

function startEditPosition(position) {
  editingPosition.value = position
  editingPositionValue.value = position
}

function savePosition() {
  const oldPos = editingPosition.value
  const newPos = editingPositionValue.value.trim()
  if (newPos && newPos !== oldPos) {
    pushSnapshot()
    for (const ch of channels.value) {
      if (ch.position === oldPos) ch.position = newPos
    }
    persistChannels()
  }
  editingPosition.value = null
}

const sortedSections = computed(() =>
  [...sectionDefs.value].sort((a, b) => a.order - b.order)
)

// ── Editor ─────────────────────────────────────────────────────────────────
let saveSetupTimer = null
let pendingSetupMd = null

function onSetupChange(md) {
  recordFocus()             // Zustand VOR der Änderung merken (setupMarkdown noch alter Wert)
  pendingSetupMd = md
  clearTimeout(saveSetupTimer)
  saveSetupTimer = setTimeout(() => { persistSetup(md); saveSetupTimer = null }, 50)
  nextTick(() => commitFocus()) // nach v-model-Update: pusht Snapshot wenn sich etwas geändert hat
}

function onOcrImport(data) {
  // 1. Aufbau-Text anhängen
  if (data.aufbau) {
    const appended = setupMarkdown.value ? `${setupMarkdown.value}\n\n---\n\n${data.aufbau}` : data.aufbau
    setupMarkdown.value = appended
    onSetupChange(appended)
  }

  // 2. Kanäle befüllen — nur leere Felder werden befüllt, befüllte bleiben unberührt
  if (data.kanaele?.length) {
    const updated = channels.value.map(ch => {
      // Passenden OCR-Eintrag suchen nach Kanalnummer (primär) oder Position (fallback)
      const match = data.kanaele.find(k =>
        (k.channel && Number(k.channel) === Number(ch.channel)) ||
        (k.position && ch.position && k.position.toLowerCase() === ch.position.toLowerCase())
      )
      if (!match) return ch

      return {
        ...ch,
        device:  ch.device?.trim()  ? ch.device  : (match.device  || ch.device),
        color:   ch.color?.trim()   ? ch.color   : (match.color   || ch.color),
        address: ch.address?.trim() ? ch.address : (match.address || ch.address),
        notes:   ch.notes?.trim()   ? ch.notes   : (match.notes   || ch.notes),
      }
    })
    channels.value = updated
    persistChannels()
    pushSnapshot()
  }
}

async function persistSetup(md) {
  setupSaving.value = true
  try {
    await updateMeta(props.id, { ...meta.value, setupMarkdown: md })
  } finally {
    setupSaving.value = false
  }
}

async function persistEosChannels() {
  await updateMeta(props.id, { ...meta.value, setupMarkdown: setupMarkdown.value, eosActiveChannels: eosActiveChannels.value })
}

async function onEosFileSelected(e) {
  const file = e.target.files?.[0]
  if (!file) return
  e.target.value = '' // Reset: dieselbe Datei kann erneut gewählt werden

  const text = await file.text()
  const { activeChannels, error } = parseEosCsv(text)

  if (error) {
    window.alert(t(error))
    return
  }

  // Merge-Vorschau berechnen
  const channelsWithNotes = new Set(
    channels.value.filter(ch => (ch.notes ?? '').trim().length > 0).map(ch => String(ch.channel))
  )

  // Hilfsfunktion: Kanal-Nr → Label (device oder position, falls vorhanden)
  function chLabel(nr) {
    const ch = channels.value.find(c => String(c.channel) === nr)
    if (!ch) return ''
    return [ch.device, ch.position].filter(Boolean).join(' / ')
  }

  const prev = eosActiveChannels.value ?? []
  const prevTracked = prev.map(ch => ch.startsWith('-') ? ch.slice(1) : ch)
    .filter(nr => !channelsWithNotes.has(nr))

  const newActiveNrs  = activeChannels.filter(nr => !channelsWithNotes.has(nr))
  const nowGoneNrs    = prevTracked.filter(nr => !activeChannels.includes(nr))
  const untouchedNrs  = activeChannels.filter(nr => channelsWithNotes.has(nr))

  // Preview-Dialog öffnen und auf Bestätigung warten
  const ok = await new Promise(resolve => {
    _eosMergeResolve = resolve
    eosMergePreview.value = {
      open: true,
      newActive:  newActiveNrs.map(nr => ({ nr, label: chLabel(nr) })),
      nowGone:    nowGoneNrs.map(nr => ({ nr, label: chLabel(nr) })),
      untouched:  untouchedNrs.map(nr => ({ nr, label: chLabel(nr) })),
    }
  })
  eosMergePreview.value.open = false
  if (!ok) return

  // Option 1: fehlende Kanäle automatisch anlegen
  const existingNrs = new Set(channels.value.map(ch => String(ch.channel)))
  const missingNrs = newActiveNrs.filter(nr => !existingNrs.has(nr))
  if (missingNrs.length > 0) {
    const newChannels = missingNrs.map(nr => ({ channel: nr, address: '', device: '', position: '', color: '', notes: '' }))
    channels.value = [...channels.value, ...newChannels]
      .sort((a, b) => parseInt(a.channel) - parseInt(b.channel))
    await saveChannels(props.id, channels.value)
  }

  // Import durchführen
  eosActiveChannels.value = [
    ...newActiveNrs,
    ...nowGoneNrs.map(nr => `-${nr}`),
  ]
  await persistEosChannels()
}

function resolveEosMergePreview(value) {
  _eosMergeResolve?.(value)
  _eosMergeResolve = null
}

function channelStatus(ch) {
  const notes = (ch.notes ?? '').trim()
  if (notes.length > 0) return 'active'   // grün — Notizen vorhanden
  const nr = String(ch.channel)
  if (!eosActiveChannels.value) return 'default'
  if (eosActiveChannels.value.includes(nr)) return 'eos'        // gelb — Eos aktiv, keine Notizen
  if (eosActiveChannels.value.includes(`-${nr}`)) return 'default'  // grau — manuell inaktiv
  return 'default'
}

async function toggleChannelStatus(ch) {
  if (!eosActiveChannels.value) return
  const nr = String(ch.channel)
  const status = channelStatus(ch)
  if (status === 'active') return  // grün = durch Notizen gesteuert, kein Toggle

  if (status === 'eos') {
    // Gelb → Grau: deaktivieren
    eosActiveChannels.value = eosActiveChannels.value.map(c => c === nr ? `-${nr}` : c)
  } else {
    // Grau → Gelb: reaktivieren (nur wenn Kanal bekannt in eosActiveChannels)
    const hasInactive = eosActiveChannels.value.includes(`-${nr}`)
    if (hasInactive) {
      eosActiveChannels.value = eosActiveChannels.value.map(c => c === `-${nr}` ? nr : c)
    }
    // Wenn Kanal gar nicht in eosActiveChannels: kein Toggle möglich
  }
  await persistEosChannels()
}

// ── History ─────────────────────────────────────────────────────────────────
async function openHistory() {
  historyOpen.value = true
  historyEntry.value = null
  historyLoading.value = true
  historyList.value = await fetchHistory(props.id)
  historyLoading.value = false
}

async function loadHistoryEntry(id) {
  historyLoading.value = true
  historyEntry.value = await fetchHistoryEntry(props.id, id)
  historyLoading.value = false
}

async function doRestoreHistory() {
  if (!historyEntry.value) return
  pushSnapshot()
  await restoreHistory(props.id, historyEntry.value.id)
  // Reload current show data
  const [chs, sections] = await Promise.all([
    fetchChannels(props.id),
    fetchShowSections(props.id),
  ])
  channels.value = Array.isArray(chs) ? chs : []
  for (const { id, content } of (Array.isArray(sections) ? sections : [])) {
    sectionContents.value.set(id, content)
  }
  historyOpen.value = false
  historyEntry.value = null
}

// ── Kanal CSV Import ───────────────────────────────────────────────────────
function onCsvImportSelected(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = e => {
    const imported = parseChannelsCsv(e.target.result)
    if (imported.length === 0) return
    pushSnapshot()
    channels.value = mergeChannels(channels.value, imported)
    persistChannels()
  }
  reader.readAsText(file)
  event.target.value = ''
}

// ── Eos CSV Parser ─────────────────────────────────────────────────────────
function parseEosCsv(text) {
  const lines = text.split(/\r?\n/)
  if (lines[0].trim() !== 'START_LEVELS') {
    return { activeChannels: null, error: 'eos.import.error.invalid' }
  }
  const headerIdx = lines.findIndex(l => l.startsWith('TARGET_TYPE,'))
  if (headerIdx === -1) return { activeChannels: null, error: 'eos.import.error.parse' }
  const headers = lines[headerIdx].split(',')
  const colChannel   = headers.indexOf('CHANNEL')
  const colParamType = headers.indexOf('PARAMETER_TYPE_AS_TEXT')
  const colLevel     = headers.indexOf('LEVEL')
  if (colChannel === -1 || colParamType === -1 || colLevel === -1) {
    return { activeChannels: null, error: 'eos.import.error.parse' }
  }
  const active = new Set()
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols[colParamType] === 'Intens' && parseFloat(cols[colLevel]) > 0) {
      const ch = (cols[colChannel] ?? '').trim()
      if (ch) active.add(ch)
    }
  }
  return { activeChannels: [...active], error: null }
}

// ── PDF ────────────────────────────────────────────────────────────────────
async function openPdf() {
  const url = await api.downloadUrl(`/api/shows/${props.id}/pdf`)
  window.open(url, '_blank')
}

// ── Kanal-Duplikat-Warnung ─────────────────────────────────────────────────
const dupWarning = computed(() => {
  const addresses = channels.value.map(c => c.address).filter(Boolean)
  return addresses.length !== new Set(addresses).size
})

const dupChannelNrs = computed(() => {
  const seen = new Set()
  const dups = new Set()
  for (const ch of channels.value) {
    if (ch.channel && seen.has(ch.channel)) dups.add(ch.channel)
    seen.add(ch.channel)
  }
  return dups
})

const dupChannelWarning = computed(() => dupChannelNrs.value.size > 0)

// ── Kanäle gruppiert ───────────────────────────────────────────────────────
const groupedChannels = computed(() => {
  const q = search.value.toLowerCase()
  // Bei aktivem Suchfilter numerisch sortieren, sonst Reihenfolge aus channels.value beibehalten
  let chs = q
    ? [...channels.value].sort((a, b) => parseInt(a.channel) - parseInt(b.channel))
    : [...channels.value]
  if (q) {
    chs = chs.filter(ch =>
      ch.channel?.includes(q) ||
      ch.device?.toLowerCase().includes(q) ||
      ch.notes?.toLowerCase().includes(q) ||
      ch.position?.toLowerCase().includes(q)
    )
  }
  const map = new Map()
  for (const ch of chs) {
    const pos = ch.position || ''
    if (!map.has(pos)) map.set(pos, [])
    map.get(pos).push(ch)
  }
  return [...map.entries()].map(([position, channels]) => ({ position, channels }))
})

// ── Drag & Drop zum Umsortieren (SortableJS direkt) ────────────────────────
let sortableInstance = null

function initSortable() {
  sortableInstance?.destroy()
  sortableInstance = null
  if (!sortableTbody.value) return
  sortableInstance = Sortable.create(sortableTbody.value, {
    handle: '.drag-handle',
    filter: '[data-no-drag]',
    preventOnFilter: false,
    animation: 150,
    onStart() {
      // Vue-Rendering während Drag pausieren um DOM-Konflikte zu vermeiden
      sortableInstance.option('disabled', false)
    },
    onEnd() {
      // DOM-Reihenfolge auslesen → channels neu aufbauen
      const keyToChannel = new Map(channels.value.map(c => [c.channel + '|' + c.address, c]))
      const reordered = []
      let currentPos = ''
      for (const tr of sortableTbody.value.rows) {
        if (tr.hasAttribute('data-no-drag') && 'pos' in tr.dataset) {
          currentPos = tr.dataset.pos
        }
        const key = tr.dataset.chKey
        if (key && keyToChannel.has(key)) {
          const ch = keyToChannel.get(key)
          ch.position = currentPos
          reordered.push(ch)
        }
      }
      if (reordered.length === channels.value.length) {
        pushSnapshot()
        channels.value.splice(0, channels.value.length, ...reordered)
      }
      persistChannels()
      // Nach Vue-Render Sortable neu binden (DOM wurde durch Vue gepatcht)
      nextTick(initSortable)
    }
  })
}

// Sortable nach externen channels-Updates neu binden (z.B. SSE-Reload)
watch(() => channels.value.length, () => nextTick(initSortable))

// SortableJS for sections
watch(() => sectionDefs.value.length, async () => {
  await nextTick()
  if (sortableSections.value) {
    Sortable.create(sortableSections.value, {
      handle: '.section-drag-handle',
      animation: 150,
      onEnd() {
        const els = sortableSections.value.querySelectorAll('[data-section-id]')
        const newOrder = [...els].map(el => el.getAttribute('data-section-id'))
        sectionDefs.value = newOrder.map((id, i) => {
          const sec = sectionDefs.value.find(s => s.id === id)
          return { ...sec, order: i }
        })
        persistSectionDefs()
      }
    })
  }
}, { immediate: true })

// SortableJS for fields within sections
watch(() => sectionDefs.value.map(s => s.fields?.length).join(','), async () => {
  await nextTick()
  document.querySelectorAll('[data-fields-sortable]').forEach(el => {
    Sortable.create(el, {
      handle: '.field-drag-handle',
      animation: 150,
      onEnd(evt) {
        const sectionId = el.getAttribute('data-fields-sortable')
        const sec = sectionDefs.value.find(s => s.id === sectionId)
        if (!sec) return
        const moved = sec.fields.splice(evt.oldIndex, 1)[0]
        sec.fields.splice(evt.newIndex, 0, moved)
        sec.fields.forEach((f, i) => { f.sort_order = i })
        persistSectionDefs()
      }
    })
  })
}, { immediate: true })

const totalVisible = computed(() => groupedChannels.value.reduce((s, g) => s + g.channels.length, 0))

// Flache Liste für globale row-Indizes (Reihenfolge wie in der Tabelle)
const flatChannels = computed(() =>
  groupedChannels.value.flatMap(g => g.channels)
)

function rowIndexOf(ch) {
  return flatChannels.value.findIndex(c => c === ch)
}

// ── Kanal löschen ──────────────────────────────────────────────────────────
async function deleteChannel(ch) {
  const ok = await confirm({ t, titleKey: 'show.channel.delete.confirm', messageParams: { channel: ch.channel }, confirmKey: 'action.delete', cancelKey: 'action.cancel' })
  if (!ok) return
  pushSnapshot()
  channels.value = channels.value.filter(c => c.channel !== ch.channel)
  persistChannels()
}

// ── Kanal hinzufügen ───────────────────────────────────────────────────────
const addingPosition = ref(null)
const addForm = ref({})

function startAdd(position) {
  addingPosition.value = position
  addForm.value = { channel: '', address: '', device: '', position, color: '', notes: '' }
}

function saveAdd() {
  if (!addForm.value.channel) return
  pushSnapshot()
  const newCh = { ...addForm.value }
  const newNr = parseInt(newCh.channel)
  // Numerisch an die richtige Position einfügen
  const idx = channels.value.findIndex(c => parseInt(c.channel) > newNr)
  if (idx === -1) channels.value.push(newCh)
  else channels.value.splice(idx, 0, newCh)
  addingPosition.value = null
  persistChannels()
}

// ── Kanäle speichern ───────────────────────────────────────────────────────
let channelsSaveTimer = null
let ignoreSseCount = 0   // Anzahl eigener Saves die noch kein SSE-Echo hatten
function persistChannels() {
  // Debounce für schnelle Folge-Aufrufe (Drag&Drop, programmatisch)
  // Bei @change-Aufrufen (blur) wird sofort gespeichert sobald der Timer feuert
  clearTimeout(channelsSaveTimer)
  channelsSaving.value = true
  channelsSaveTimer = setTimeout(async () => {
    channelsSaveTimer = null
    ignoreSseCount++
    try { await saveChannels(props.id, channels.value) }
    finally { channelsSaving.value = false }
  }, 50)
}

// ── Fotos ──────────────────────────────────────────────────────────────────
const dragging = ref(false)
const lightboxPhoto = ref(null)
const uploadQueue = ref([]) // [{ name, progress, done, error }]
const photoCaptions = ref({}) // { filename: { caption, channelNumber } }

async function onCaptionBlur(filename, event) {
  const caption = event.target.value
  photoCaptions.value[filename] = { ...(photoCaptions.value[filename] ?? {}), caption }
  await savePhotoCaption(props.id, filename, caption, photoCaptions.value[filename]?.channelNumber ?? '')
}

async function onChannelNumberBlur(filename, event) {
  const channelNumber = event.target.value
  photoCaptions.value[filename] = { ...(photoCaptions.value[filename] ?? {}), channelNumber }
  await savePhotoCaption(props.id, filename, photoCaptions.value[filename]?.caption ?? '', channelNumber)
}

async function uploadFiles(files) {
  uploadQueue.value = files.map(f => ({ name: f.name, progress: 0, done: false, error: false }))
  for (let i = 0; i < files.length; i++) {
    try {
      await uploadPhoto(props.id, files[i], (p) => {
        uploadQueue.value[i].progress = p
      })
      uploadQueue.value[i].done = true
      photos.value = await fetchPhotos(props.id)
    } catch {
      uploadQueue.value[i].error = true
    }
  }
  setTimeout(() => { uploadQueue.value = [] }, 2000)
}

function onFileInput(e) { uploadFiles([...e.target.files]); e.target.value = '' }
function onDrop(e) {
  dragging.value = false
  const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'))
  if (files.length) uploadFiles(files)
}

async function onDeletePhoto(filename) {
  const ok = await confirm({ t, titleKey: 'show.photo.delete.confirm', confirmKey: 'action.delete', cancelKey: 'action.cancel' })
  if (!ok) return
  await deletePhoto(props.id, filename)
  photos.value = photos.value.filter(f => f !== filename)
  delete photoCaptions.value[filename]
}

const lightboxIndex = computed(() => photos.value.indexOf(lightboxPhoto.value))

function openLightbox(filename) {
  lightboxPhoto.value = filename
}

function lightboxStep(dir) {
  const idx = lightboxIndex.value + dir
  if (idx >= 0 && idx < photos.value.length) {
    lightboxPhoto.value = photos.value[idx]
  }
}

function onLightboxKey(e) {
  if (!lightboxPhoto.value) return
  if (e.key === 'ArrowRight') lightboxStep(1)
  else if (e.key === 'ArrowLeft') lightboxStep(-1)
  else if (e.key === 'Escape') lightboxPhoto.value = null
}

// ── Sections ───────────────────────────────────────────────────────────────

function onSectionChange(id, value) {
  recordFocus()             // Zustand VOR der Änderung (sectionContents noch nicht aktualisiert)
  sectionContents.value = new Map(sectionContents.value)
  sectionContents.value.set(id, value)
  clearTimeout(saveSectionsTimer)
  saveSectionsTimer = setTimeout(() => { persistSections(); saveSectionsTimer = null }, 50)
  nextTick(() => commitFocus())
}

let ignoreSectionsSseCount = 0
async function persistSections() {
  sectionsSaving.value = true
  ignoreSectionsSseCount++
  try {
    const sections = [...sectionContents.value.entries()].map(([id, content]) => ({ id, content }))
    await saveShowSections(props.id, sections)
  } finally {
    sectionsSaving.value = false
  }
}

function parseFieldValue(sectionId, key) {
  const raw = sectionContents.value.get(sectionId) ?? '{}'
  try { return JSON.parse(raw)[key] ?? '' } catch { return '' }
}

function onFieldChange(sectionId, key, value) {
  const raw = sectionContents.value.get(sectionId) ?? '{}'
  let obj = {}
  try { obj = JSON.parse(raw) } catch {}
  if (value === '') { delete obj[key] } else { obj[key] = value }
  onSectionChange(sectionId, JSON.stringify(obj))
}

// ── Section Defs verwalten ─────────────────────────────────────────────────

async function persistSectionDefs() {
  await saveShowSectionDefs(props.id, sectionDefs.value)
}

async function addMarkdownSection() {
  pushSnapshot()
  const id = uuid()
  sectionDefs.value.push({ id, title: '', type: 'markdown', order: sectionDefs.value.length, fields: [] })
  await persistSectionDefs()
}

async function addFieldsSection() {
  pushSnapshot()
  const id = uuid()
  sectionDefs.value.push({ id, title: '', type: 'fields', order: sectionDefs.value.length, fields: [] })
  await persistSectionDefs()
}

async function deleteSectionDef(idx) {
  const ok = await confirm({ t, titleKey: 'action.delete', confirmKey: 'action.delete', cancelKey: 'action.cancel' })
  if (!ok) return
  pushSnapshot()
  sectionDefs.value.splice(idx, 1)
  sectionDefs.value.forEach((s, i) => s.order = i)
  persistSectionDefs()
}


function addFieldDef(section) {
  pushSnapshot()
  section.fields.push({ key: uuid().slice(0, 8), label: '' })
  persistSectionDefs()
}

async function deleteFieldDef(section, idx) {
  const ok = await confirm({ t, titleKey: 'action.delete', confirmKey: 'action.delete', cancelKey: 'action.cancel' })
  if (!ok) return
  pushSnapshot()
  section.fields.splice(idx, 1)
  persistSectionDefs()
}

function hasFieldsType() {
  return sectionDefs.value.some(s => s.type === 'fields')
}

async function loadFloorplan() {
  const data = await fetchShowFloorplan(props.id).catch(() => null)
  if (data) floorplan.value = data
}

function onFloorplanChange(svgData) {
  floorplan.value = { ...floorplan.value, svg_data: svgData }
  clearTimeout(floorplanSaveTimer)
  floorplanSaveTimer = setTimeout(async () => {
    await saveShowFloorplan(props.id, svgData).catch(() => {})
  }, 1500)
}

function jumpToChannel(channelNum) {
  mobileTab.value = 'channels'
}


// ── Laden ──────────────────────────────────────────────────────────────────
let unsubscribeSSE = null
let snapshotInterval = null
const presence = ref([]) // [{ username, devices }]

onMounted(async () => {
  try {
    const [showData, chs, photoList, captions, sections, defs] = await Promise.all([
      fetchShow(props.id),
      fetchChannels(props.id),
      fetchPhotos(props.id),
      fetchPhotoCaptions(props.id),
      fetchShowSections(props.id),
      fetchShowSectionDefs(props.id),
    ])

    meta.value = { name: showData.name, datum: showData.datum, template: showData.template, untertitel: showData.untertitel, spielzeit: showData.spielzeit }
    setupMarkdown.value = showData.setupMarkdown ?? ''
    eosActiveChannels.value = showData.eosActiveChannels ?? null
    channels.value = Array.isArray(chs) ? chs : []
    photos.value = photoList
    photoCaptions.value = captions ?? {}

    sectionContents.value = new Map((Array.isArray(sections) ? sections : []).map(s => [s.id, s.content]))
    sectionDefs.value = Array.isArray(defs) ? defs : []
  } catch (e) {
    console.error('Ladefehler:', e)
  } finally {
    loading.value = false
  }

  // Initialer Snapshot: sauberer Ausgangspunkt für Undo, löscht alte sessionStorage-History
  // Außerhalb des try-Blocks damit er immer ausgeführt wird (auch bei teilweisem Ladefehler)
  initSnapshot()
  // Server-seitiger Snapshot beim Öffnen + alle 10 Minuten (fire-and-forget)
  createSnapshot(props.id).catch(() => {})
  snapshotInterval = setInterval(() => createSnapshot(props.id).catch(() => {}), 10 * 60 * 1000)

  // Floorplan laden
  loadFloorplan().catch(() => {})

  // SSE — gemeinsame Verbindung für Channels, Sections und Presence
  unsubscribeSSE = subscribeShow(props.id, {
    onChannels: async () => {
      if (ignoreSseCount > 0) { ignoreSseCount--; return }
      channels.value = await fetchChannels(props.id)
    },
    onSections: async () => {
      if (ignoreSectionsSseCount > 0) { ignoreSectionsSseCount--; return }
      const sections = await fetchShowSections(props.id)
      for (const { id, content } of (Array.isArray(sections) ? sections : [])) {
        sectionContents.value.set(id, content)
      }
    },
    onPresence: ({ users }) => {
      presence.value = users
    },
  })

  // Drag & Drop initialisieren
  await nextTick()
  initSortable()

  // Scroll-Position wiederherstellen
  const scrollKey = `scroll_${props.id}`
  const saved = sessionStorage.getItem(scrollKey)
  if (saved) {
    await nextTick()
    window.scrollTo({ top: parseInt(saved), behavior: 'instant' })
  }
  const onScroll = () => sessionStorage.setItem(scrollKey, window.scrollY)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('keydown', onUndoRedoKeydown)
  window.addEventListener('keydown', onLightboxKey)
  onBeforeUnmount(() => {
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('keydown', onLightboxKey)
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onUndoRedoKeydown)
  unsubscribeSSE?.()
  clearInterval(snapshotInterval)
  if (saveSetupTimer) { clearTimeout(saveSetupTimer); persistSetup(pendingSetupMd) }
  if (channelsSaveTimer) { clearTimeout(channelsSaveTimer); persistChannels() }
  if (saveSectionsTimer) { clearTimeout(saveSectionsTimer); persistSections() }
  if (floorplanSaveTimer) { clearTimeout(floorplanSaveTimer) }
})

</script>
