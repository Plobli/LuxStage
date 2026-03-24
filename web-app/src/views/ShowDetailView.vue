<template>
  <div>
    <!-- Top Header -->
    <div class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-white/10 bg-gray-950 px-4 sm:px-6 lg:px-8">
      <button type="button" class="text-gray-400 hover:text-white" @click="router.push('/')">
        <span class="sr-only">{{ t('action.back') }}</span>
        <svg class="size-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clip-rule="evenodd" /></svg>
      </button>
      <div class="h-6 w-px bg-white/10" aria-hidden="true"></div>
      <!-- Mobile Tab-Switcher (nur < xl) -->
      <div class="flex xl:hidden gap-1 mr-2">
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
        <span v-if="dupWarning" class="text-xs text-yellow-400">⚠ {{ t('channel.dup_address') }}</span>
        <span v-if="dupChannelWarning" class="text-xs text-yellow-400">⚠ {{ t('channel.dup_channel') }}</span>
        <div class="grid grid-cols-1">
          <input
            v-model="search"
            type="search"
            :placeholder="t('channel.search')"
            class="col-start-1 row-start-1 block w-48 bg-white/5 py-1.5 pr-3 pl-9 text-sm text-white outline-1 -outline-offset-1 outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-accent rounded-md placeholder:text-gray-500"
          />
          <MagnifyingGlassIcon class="pointer-events-none col-start-1 row-start-1 ml-3 size-4 self-center text-gray-400" aria-hidden="true" />
        </div>
      </div>
      <div class="h-6 w-px bg-white/10 shrink-0" aria-hidden="true"></div>
      <div class="no-print flex items-center gap-x-3 shrink-0">
        <button
          type="button"
          class="no-print rounded-md px-3 py-1.5 text-sm font-semibold text-gray-400 ring-1 ring-white/10 hover:ring-white/20"
          @click="openHistory"
        >
          {{ t('history.btn') }}
        </button>
        <button
          type="button"
          class="rounded-md px-3 py-1.5 text-sm font-semibold text-gray-400 ring-1 ring-white/10 hover:ring-white/20"
          @click="downloadChannelsCsv(props.id, channels)"
        >
          {{ t('channel.export') }}
        </button>
        <button
          type="button"
          class="rounded-md px-3 py-1.5 text-sm font-semibold text-amber-400 ring-1 ring-amber-400/30 hover:ring-amber-400/60 no-print"
          @click="eosFileInput?.click()"
        >
          {{ t('eos.import.button') }}
        </button>
        <input ref="eosFileInput" type="file" accept=".csv" class="hidden" @change="onEosFileSelected" />
        <a
          :href="pdfUrl"
          target="_blank"
          class="rounded-md px-3 py-1.5 text-sm font-semibold text-gray-400 ring-1 ring-white/10 hover:ring-white/20"
        >
          {{ t('show.pdf') }}
        </a>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center h-64 text-sm text-gray-400">…</div>

    <template v-else>
      <!-- Two-column layout: aside + main -->
      <div :class="mobileTab !== 'channels' ? 'hidden xl:block' : ''" class="xl:pl-[28rem] xl:ml-0">
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
                <col class="w-16" />           <!-- Kanal + Adresse -->
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
                          :value="ch.channel"
                          @focus="pushSnapshot()"
                          @change="ch.channel = $event.target.value; persistChannels()"
                          :data-nav-row="rowIndexOf(ch)"
                          data-nav-col="0"
                          @keydown="onKeydown($event, rowIndexOf(ch), 0, 4, () => startAdd(ch.position))"
                          :class="[dupChannelNrs.has(ch.channel) ? 'ring-1 ring-yellow-400/60 rounded' : '', channelStatus(ch) === 'active' ? 'text-green-400' : channelStatus(ch) === 'eos' ? 'text-amber-400' : 'text-gray-400']"
                          class="bg-transparent focus:bg-white/5 focus:outline-none focus:ring-0 text-2xl font-bold font-mono px-0 border-0 leading-none w-[3ch] text-center"
                        />
                        <input
                          :value="ch.address"
                          @focus="pushSnapshot()"
                          @change="ch.address = $event.target.value; persistChannels()"
                          class="bg-transparent focus:bg-white/5 focus:outline-none focus:ring-0 text-xs text-gray-500 px-0 border-0 w-[5ch] text-center"
                        />
                      </div>
                    </td>
                    <td class="px-3 py-2 align-middle">
                      <ColorAutocomplete
                        :modelValue="ch.color"
                        @update:modelValue="ch.color = $event"
                        @focus="pushSnapshot()"
                        @change="persistChannels()"
                        :placeholder="t('field.color')"
                      />
                    </td>
                    <td class="px-3 py-0 align-middle">
                      <textarea
                        :value="ch.device"
                        @focus="pushSnapshot()"
                        @change="ch.device = $event.target.value; persistChannels()"
                        :data-nav-row="rowIndexOf(ch)"
                        data-nav-col="2"
                        @keydown="onKeydown($event, rowIndexOf(ch), 2, 4, null)"
                        class="bg-white/[0.04] focus:bg-white/[0.07] focus:outline-none focus:ring-0 text-sm text-gray-300 w-full px-2 border-0 resize-none leading-snug [field-sizing:content] min-h-14 py-4 align-middle rounded"
                      />
                    </td>
                    <td class="px-3 py-0 align-middle">
                      <textarea
                        :value="ch.notes"
                        @focus="pushSnapshot()"
                        @change="ch.notes = $event.target.value; persistChannels()"
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
                        <input autofocus class="bg-transparent focus:outline-none text-2xl font-bold font-mono text-white px-0 border-0 leading-none w-[3ch] text-center" v-model="addForm.channel" :placeholder="t('show.channel.nr')" />
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
                      <input autofocus class="bg-transparent focus:outline-none text-2xl font-bold font-mono text-white px-0 border-0 leading-none w-[3ch] text-center" v-model="addForm.channel" :placeholder="t('show.channel.nr')" />
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

      <!-- Aside: Sections + Fotos (fixed, left of main) -->
      <aside :class="mobileTab !== 'info' ? 'hidden xl:block' : ''" class="xl:fixed xl:top-16 xl:bottom-0 xl:left-20 xl:w-[28rem] xl:overflow-y-auto xl:border-r xl:border-white/10 px-4 py-6 sm:px-6 border-b border-white/10 xl:border-b-0">

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
        <div class="flex items-center gap-3 mb-6">
          <SectionHeading :text="t('sections.new')" class="flex-1 min-w-0" />
          <button class="cursor-pointer text-sm text-gray-400 hover:text-white shrink-0" @click="addMarkdownSection">{{ t('sections.add.markdown') }}</button>
          <button v-if="!hasFieldsType()" class="cursor-pointer text-sm text-gray-400 hover:text-white shrink-0" @click="addFieldsSection">{{ t('sections.add.fields') }}</button>
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
              <li v-for="filename in photos" :key="filename" class="relative group">
                <div class="aspect-square block w-full overflow-hidden rounded-lg bg-gray-800 cursor-pointer" @click="openLightbox(filename)">
                  <img :src="getPhotoUrl(props.id, filename)" :alt="filename" class="pointer-events-none object-cover group-hover:opacity-75 w-full h-full" />
                </div>
                <button
                  type="button"
                  class="absolute top-1 right-1 rounded bg-black/60 px-1 py-0.5 text-xs text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                  @click="onDeletePhoto(filename)"
                  :title="t('action.delete')"
                >✕</button>
              </li>
            </ul>
          </div>
        </section>
      </aside>
    </template>

    <!-- Lightbox -->
    <div v-if="lightboxPhoto" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80" @click="lightboxPhoto = null">
      <img :src="getPhotoUrl(props.id, lightboxPhoto)" class="max-h-screen max-w-screen-lg object-contain" @click.stop />
    </div>

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
import { fetchShow, updateMeta, fetchHistory, fetchHistoryEntry, restoreHistory } from '../api/shows.js'
import { fetchChannels, saveChannels, downloadChannelsCsv } from '../api/channels.js'
import { fetchPhotos, uploadPhoto, deletePhoto, getPhotoUrl } from '../api/photos.js'
import { subscribeChannels, subscribeSections } from '../api/client.js'
import { api } from '../api/client.js'
import { fetchShowSections, saveShowSections, fetchShowSectionDefs, saveShowSectionDefs } from '../api/sections.js'
import { uuid } from '../utils/uuid.js'
import ColorAutocomplete from '../components/ColorAutocomplete.vue'
import Sortable from 'sortablejs'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()
const { t } = useLocale()
const { confirm } = useConfirm()
const { onKeydown } = useKeyboardNav()

// ── State ──────────────────────────────────────────────────────────────────
const loading = ref(true)
const meta = ref({})          // frontmatter: name, datum, venue, …
const setupMarkdown = ref('') // Aufbau-Abschnitt aus .md-Datei
const eosActiveChannels = ref(null) // null = noch kein Import; Array<string> (neg. Prefix = inaktiv)
const channels = ref([])
const photos = ref([])

const sortableTbody = ref(null)
const eosFileInput = ref(null)
const historyOpen = ref(false)
const historyList = ref([])
const historyEntry = ref(null)      // selected snapshot detail
const historyLoading = ref(false)
const search = ref('')
const setupSaving = ref(false)
const channelsSaving = ref(false)

const mobileTab = ref('channels') // 'channels' | 'info'

const sectionDefs = ref([])
const sectionContents = ref(new Map())
const sectionsSaving = ref(false)
const sortableSections = ref(null)
let saveSectionsTimer = null

// ── Undo/Redo ──────────────────────────────────────────────────────────────
const { pushSnapshot, pushSnapshotDebounced, cancelDebounce, undo, redo, canUndo, canRedo } =
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
  pushSnapshotDebounced()
  pendingSetupMd = md
  clearTimeout(saveSetupTimer)
  saveSetupTimer = setTimeout(() => { persistSetup(md); saveSetupTimer = null }, 50)
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

  // Warnung bei 0 aktiven Kanälen
  if (activeChannels.length === 0) {
    const ok = await confirm({
      t,
      titleKey: 'eos.import.confirm_empty.title',
      messageKey: 'eos.import.confirm_empty.message',
      confirmKey: 'eos.import.confirm_empty.confirm',
      cancelKey: 'action.cancel',
    })
    if (!ok) return
  }

  // Re-Import: prüfe ob bisher aktive Kanäle wegfallen
  if (eosActiveChannels.value !== null) {
    const currentActive = eosActiveChannels.value.filter(ch => !ch.startsWith('-'))
    const removed = currentActive.filter(ch => !activeChannels.includes(ch))
    if (removed.length > 0) {
      const ok = await confirm({
        t,
        titleKey: 'eos.reimport.title',
        messageKey: 'eos.reimport.message',
        messageParams: {
          n: removed.length,
          channels: removed.join(', '),
        },
        confirmKey: 'eos.reimport.confirm',
        cancelKey: 'action.cancel',
      })
      if (!ok) return
    }
  }

  // Import durchführen.
  // Regel: Import ist autoritativ — überschreibt manuelle Overrides.
  // Kanäle im neuen CSV            → immer aktiv (grün)
  // Kanäle vorher aktiv, jetzt weg → werden rot
  // Kanäle vorher manuell rot, jetzt weg → bleiben rot
  // Kanäle vorher manuell rot, jetzt im CSV → werden grün (import wins)
  const prev = eosActiveChannels.value ?? []
  const prevActive   = prev.filter(ch => !ch.startsWith('-'))
  const prevInactive = prev.filter(ch => ch.startsWith('-')).map(ch => ch.slice(1))

  // Alle Kanäle die vorher bekannt waren, aber nicht im neuen CSV → rot
  const nowGone = [...prevActive, ...prevInactive].filter(ch => !activeChannels.includes(ch))

  eosActiveChannels.value = [
    ...activeChannels,                // alle neuen: grün
    ...nowGone.map(ch => `-${ch}`),   // weggefallene: rot
  ]
  await persistEosChannels()
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
const pdfUrl = computed(() => api.url(`/api/shows/${props.id}/pdf`))

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
}

function openLightbox(filename) {
  lightboxPhoto.value = filename
}

// ── Sections ───────────────────────────────────────────────────────────────

function onSectionChange(id, value) {
  sectionContents.value = new Map(sectionContents.value)
  sectionContents.value.set(id, value)
  pushSnapshotDebounced()
  clearTimeout(saveSectionsTimer)
  saveSectionsTimer = setTimeout(() => { persistSections(); saveSectionsTimer = null }, 50)
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


// ── Laden ──────────────────────────────────────────────────────────────────
let unsubscribeSSE = null
let unsubscribeSectionsSSE = null

onMounted(async () => {
  try {
    const [showData, chs, photoList, sections, defs] = await Promise.all([
      fetchShow(props.id),
      fetchChannels(props.id),
      fetchPhotos(props.id),
      fetchShowSections(props.id),
      fetchShowSectionDefs(props.id),
    ])

    meta.value = { name: showData.name, datum: showData.datum, template: showData.template, untertitel: showData.untertitel, spielzeit: showData.spielzeit }
    setupMarkdown.value = showData.setupMarkdown ?? ''
    eosActiveChannels.value = showData.eosActiveChannels ?? null
    channels.value = Array.isArray(chs) ? chs : []
    photos.value = photoList

    sectionContents.value = new Map((Array.isArray(sections) ? sections : []).map(s => [s.id, s.content]))
    sectionDefs.value = Array.isArray(defs) ? defs : []
  } catch (e) {
    console.error('Ladefehler:', e)
  } finally {
    loading.value = false
  }

  // SSE für Realtime-Updates von anderen Nutzern
  unsubscribeSSE = subscribeChannels(props.id, async () => {
    // SSE-Echo vom eigenen Save überspringen
    if (ignoreSseCount > 0) { ignoreSseCount--; return }
    channels.value = await fetchChannels(props.id)
  })

  // SSE für Realtime Sections-Updates
  unsubscribeSectionsSSE = subscribeSections(props.id, async () => {
    if (ignoreSectionsSseCount > 0) { ignoreSectionsSseCount--; return }
    const sections = await fetchShowSections(props.id)
    for (const { id, content } of (Array.isArray(sections) ? sections : [])) {
      sectionContents.value.set(id, content)
    }
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
  onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
})

onBeforeUnmount(() => {
  cancelDebounce()
  window.removeEventListener('keydown', onUndoRedoKeydown)
  unsubscribeSSE?.()
  unsubscribeSectionsSSE?.()
  if (saveSetupTimer) { clearTimeout(saveSetupTimer); persistSetup(pendingSetupMd) }
  if (channelsSaveTimer) { clearTimeout(channelsSaveTimer); persistChannels() }
  if (saveSectionsTimer) { clearTimeout(saveSectionsTimer); persistSections() }
})

</script>
