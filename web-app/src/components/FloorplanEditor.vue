<template>
  <div class="relative flex h-full overflow-hidden bg-background text-foreground">
    <!-- Left Toolbar -->
    <div class="w-[56px] bg-muted/30 border-r border-border flex flex-col items-center py-2 gap-1 z-10 shrink-0">
      <ToolBtn :active="activeTool === 'select'" title="Auswählen (V)" @click="activeTool = 'select'">
        <MousePointer2 class="w-5 h-5" />
      </ToolBtn>
      <ToolBtn :active="activeTool === 'pan'" title="Verschieben (H)" @click="activeTool = 'pan'">
        <Hand class="w-5 h-5" />
      </ToolBtn>
      <Separator class="w-8 my-1" />
      <ToolBtn :active="activeTool === 'line'" title="Linie (L)" @click="activeTool = 'line'">
        <Minus class="w-5 h-5 rotate-45" />
      </ToolBtn>
      <ToolBtn :active="activeTool === 'rect'" title="Rechteck (R)" @click="activeTool = 'rect'">
        <Square class="w-5 h-5" />
      </ToolBtn>
      <ToolBtn :active="activeTool === 'ellipse'" title="Ellipse (E)" @click="activeTool = 'ellipse'">
        <Circle class="w-5 h-5" />
      </ToolBtn>
      <ToolBtn :active="activeTool === 'text'" title="Text (T)" @click="activeTool = 'text'">
        <Type class="w-5 h-5" />
      </ToolBtn>
      <ToolBtn :active="activeTool === 'channel'" title="Kanal platzieren (C)" @click="activeTool = 'channel'">
        <CircleDot class="w-5 h-5" />
      </ToolBtn>
      <ToolBtn :active="activeTool === 'tower'" title="Gassenturm platzieren" @click="openTowerPlacer">
        <Layers class="w-5 h-5" />
      </ToolBtn>
      <ToolBtn :active="activeTool === 'bar'" title="Zugstange platzieren" @click="openBarPlacer">
        <AlignJustify class="w-5 h-5" />
      </ToolBtn>
      <ToolBtn :active="activeTool === 'ruler'" title="Maßstab kalibrieren" @click="activeTool = 'ruler'">
        <Ruler class="w-5 h-5" />
      </ToolBtn>
      <Separator class="w-8 my-1" />

      <ToolBtn title="Hintergrundbild hochladen" @click="imageUploadInput?.click()">
        <Upload class="w-5 h-5" />
      </ToolBtn>
      <ToolBtn v-if="bgImage" title="Hintergrundbild entfernen" variant="danger" @click="emit('delete-image')">
        <ImageOff class="w-5 h-5" />
      </ToolBtn>
      <input ref="imageUploadInput" type="file" accept="image/*" class="hidden" @change="onImageFileSelected" />

      <ToolBtn title="Als PNG exportieren" @click="exportPNG">
        <Download class="w-5 h-5" />
      </ToolBtn>

      <div class="flex-1"></div>

      <ToolBtn :disabled="historyIndex <= 0" title="Rückgängig (Ctrl+Z)" @click="undo">
        <Undo2 class="w-5 h-5" />
      </ToolBtn>
      <ToolBtn :disabled="historyIndex >= history.length - 1" title="Wiederholen (Ctrl+Y)" @click="redo">
        <Redo2 class="w-5 h-5" />
      </ToolBtn>
      <ToolBtn :disabled="selectedIds.size === 0" variant="danger" title="Auswahl löschen (Delete)" @click="deleteSelected">
        <Trash2 class="w-5 h-5" />
      </ToolBtn>
    </div>

    <!-- Center Canvas -->
    <div
      ref="containerEl"
      class="flex-1 relative overflow-hidden"
      :class="(activeTool === 'pan' || spaceHeld) ? 'cursor-grab' : activeTool === 'ruler' ? 'cursor-crosshair' : activeTool !== 'select' ? 'cursor-crosshair' : 'cursor-default'"
      :style="isPanning ? 'cursor:grabbing' : ''"
      @mousedown="onContainerMouseDown"
      @mousemove="onContainerMouseMove"
      @mouseup="onContainerMouseUp"
      @dblclick="onContainerDblClick"
    >
      <div 
        class="absolute origin-top-left" 
        :style="{ transform: `translate(${containerOffsetX}px, ${containerOffsetY}px) scale(${stageScale}) translate(${panOffset.x}px, ${panOffset.y}px)`, width: stageSize.width + 'px', height: stageSize.height + 'px' }"
      >
        <svg ref="svgRef" :width="stageSize.width" :height="stageSize.height" class="absolute inset-0 overflow-visible" style="user-select: none;">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#dc3740" />
            </marker>
          </defs>

          <!-- Background image -->
          <image v-if="bgImageSrc" id="bg-image" :href="bgImageSrc" x="0" y="0" :width="stageSize.width" :height="stageSize.height" preserveAspectRatio="none" style="pointer-events: none;" />

          <!-- Grid -->
          <g v-if="showGrid" stroke="rgba(100,100,100,0.3)" stroke-width="1" style="pointer-events: none;">
            <line v-for="x in gridVerticalLines" :key="'gv'+x" :x1="x" :y1="gridTop" :x2="x" :y2="gridBottom" />
            <line v-for="y in gridHorizontalLines" :key="'gh'+y" :x1="gridLeft" :y1="y" :x2="gridRight" :y2="y" />
          </g>

          <!-- Elements -->
          <g v-for="el in elements" :key="el.id" :transform="getTransform(el)" @mousedown.stop="onNodeMouseDown(el.id, $event)" @dblclick.stop="onNodeDblClick(el.id)" @mouseenter="hoveredId = el.id" @mouseleave="hoveredId = null">
            <!-- Highlight when selected -->
            <rect v-if="selectedIds.has(el.id) && el.type !== 'line' && el.type !== 'channel'"
                  :x="getBounds(el).x" :y="getBounds(el).y" :width="getBounds(el).w" :height="getBounds(el).h"
                  fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="4,4" />

            <!-- Line -->
            <line v-if="el.type === 'line'" :x1="el.x1" :y1="el.y1" :x2="el.x2" :y2="el.y2" 
                  :stroke="el.color || '#6b7280'" :stroke-width="el.strokeWidth || 2" />
            <!-- Line selection box / invisible hit area -->
            <line v-if="el.type === 'line'" :x1="el.x1" :y1="el.y1" :x2="el.x2" :y2="el.y2" stroke="transparent" stroke-width="16" style="cursor: pointer;" />
            
            <circle v-if="selectedIds.has(el.id) && el.type === 'line'" :cx="el.x1" :cy="el.y1" r="5" fill="#f59e0b" cursor="pointer" @mousedown.stop="startResizeLine(el.id, 1, $event)" />
            <circle v-if="selectedIds.has(el.id) && el.type === 'line'" :cx="el.x2" :cy="el.y2" r="5" fill="#f59e0b" cursor="pointer" @mousedown.stop="startResizeLine(el.id, 2, $event)" />

            <!-- Rect -->
            <rect v-else-if="el.type === 'rect'" :x="el.x" :y="el.y" :width="el.w" :height="el.h" 
                  :fill="el.fill || 'transparent'" :stroke="el.color || '#6b7280'" :stroke-width="el.strokeWidth || 2" style="cursor: pointer;" />

            <!-- Ellipse -->
            <ellipse v-else-if="el.type === 'ellipse'" :cx="el.x" :cy="el.y" :rx="el.rx" :ry="el.ry" 
                     :fill="el.fill || 'transparent'" :stroke="el.color || '#6b7280'" :stroke-width="el.strokeWidth || 2" style="cursor: pointer;" />

            <!-- Text -->
            <text v-else-if="el.type === 'text'" :x="el.x" :y="el.y" :fill="el.color || '#9ca3af'" 
                  :font-size="el.fontSize || 16" :font-weight="el.fontStyle === 'bold' ? 'bold' : 'normal'" 
                  dominant-baseline="hanging" style="cursor: pointer;">{{ el.text }}</text>

            <!-- Tower Node -->
            <g v-else-if="el.type === 'tower'" style="cursor: pointer;" @dblclick.stop="emit('open-tower', el.towerId)">
              <rect :x="el.x" :y="el.y" :width="el.w || 80" :height="el.h || 50" rx="6"
                    :fill="selectedIds.has(el.id) ? 'rgba(251,191,36,0.12)' : 'rgba(99,102,241,0.12)'"
                    :stroke="selectedIds.has(el.id) ? '#f59e0b' : '#6366f1'"
                    stroke-width="2" />
              <!-- Side badge -->
              <rect v-if="towerForEl(el)?.side" :x="el.x + (el.w || 80) - 20" :y="el.y + 4" width="16" height="14" rx="3" fill="#6366f1" />
              <text v-if="towerForEl(el)?.side" :x="el.x + (el.w || 80) - 12" :y="el.y + 14" fill="#fff" font-size="9" font-weight="bold" text-anchor="middle" dominant-baseline="auto">{{ towerForEl(el)?.side }}</text>
              <!-- Name -->
              <text :x="el.x + 8" :y="el.y + 16" fill="#a5b4fc" font-size="11" font-weight="600" dominant-baseline="auto">{{ towerForEl(el)?.name || el.towerName || 'Turm' }}</text>
              <!-- Slot count -->
              <text :x="el.x + 8" :y="el.y + 32" fill="#6b7280" font-size="10" dominant-baseline="auto">{{ filledSlotsLabel(el) }}</text>
            </g>

            <!-- Bar Node -->
            <g v-else-if="el.type === 'bar'" style="cursor: pointer;">
              <!-- Background rect for selection -->
              <rect :x="el.x" :y="el.y" :width="el.w || 160" :height="el.h || 28" rx="4"
                    :fill="selectedIds.has(el.id) ? 'rgba(251,191,36,0.08)' : 'rgba(16,185,129,0.06)'"
                    :stroke="selectedIds.has(el.id) ? '#f59e0b' : 'rgba(16,185,129,0.3)'"
                    stroke-width="1" stroke-dasharray="4,2" />
              <!-- Main bar line -->
              <line :x1="el.x" :y1="el.y + (el.h || 28) / 2" :x2="el.x + (el.w || 160)" :y2="el.y + (el.h || 28) / 2"
                    :stroke="selectedIds.has(el.id) ? '#f59e0b' : '#10b981'" stroke-width="5" stroke-linecap="round" />
              <!-- Name label -->
              <text :x="el.x + 4" :y="el.y - 3" fill="#6ee7b7" font-size="9" font-weight="600" dominant-baseline="auto">{{ barForEl(el)?.name || el.barName || 'Stange' }}</text>
              <!-- Fixture pins -->
              <g v-for="fx in (barForEl(el)?.fixtures ?? [])" :key="fx.channel_id">
                <circle
                  :cx="el.x + fixtureXOffset(fx.position, barForEl(el)?.length_cm, el.w || 160)"
                  :cy="el.y + (el.h || 28) / 2"
                  r="10"
                  fill="#dc3740"
                  stroke="rgba(220,55,64,0.4)"
                  stroke-width="3"
                />
                <text
                  :x="el.x + fixtureXOffset(fx.position, barForEl(el)?.length_cm, el.w || 160)"
                  :y="el.y + (el.h || 28) / 2"
                  fill="white" font-size="8" font-weight="700" text-anchor="middle" dominant-baseline="central"
                >{{ channelNrById(fx.channel_id) }}</text>
              </g>
            </g>

            <!-- Channel -->
            <g v-else-if="el.type === 'channel'" style="cursor: pointer;">
              <!-- Selection indicator -->
              <rect v-if="selectedIds.has(el.id)" :x="-pillW(el.channel)/2 - 4" :y="-22" :width="pillW(el.channel) + 8" :height="44" rx="22" fill="none" stroke="#dc3740" stroke-width="2" stroke-dasharray="4,3" />
              <!-- Arrow -->
              <line :x1="getArrowPoints(el.channel, el.rotation).x1" :y1="getArrowPoints(el.channel, el.rotation).y1"
                    :x2="getArrowPoints(el.channel, el.rotation).x2" :y2="getArrowPoints(el.channel, el.rotation).y2"
                    stroke="#dc3740" stroke-width="3" marker-end="url(#arrowhead)" />
              <!-- Pill -->
              <rect :x="-pillW(el.channel)/2" y="-18" :width="pillW(el.channel)" :height="36" rx="18" fill="#dc3740" stroke="#dc3740" stroke-width="2" />
              <!-- Text -->
              <text x="0" y="0" fill="#fff" font-size="18" font-weight="bold" text-anchor="middle" dominant-baseline="central">{{ el.channel }}</text>
              <!-- Rotation handle at arrow tip -->
              <circle
                v-if="hoveredId === el.id || selectedIds.has(el.id)"
                :cx="getArrowPoints(el.channel, el.rotation).x2"
                :cy="getArrowPoints(el.channel, el.rotation).y2"
                r="7"
                fill="white"
                stroke="#dc3740"
                stroke-width="2"
                cursor="grab"
                @mousedown.stop="startArrowRotateDrag(el, $event)"
              />
            </g>

            <!-- Resize handle for rect/ellipse -->
            <circle v-if="selectedIds.has(el.id) && ['rect', 'ellipse'].includes(el.type)"
                    :cx="getBounds(el).x + getBounds(el).w" :cy="getBounds(el).y + getBounds(el).h" 
                    r="5" fill="#f59e0b" cursor="nwse-resize" @mousedown.stop="startResizeRectEllipse(el.id, $event)" />
          </g>

          <!-- Preview shape -->
          <line v-if="preview && activeTool === 'line'" :x1="preview.x1" :y1="preview.y1" :x2="preview.x2" :y2="preview.y2" stroke="#3b82f6" stroke-width="2" stroke-dasharray="4,4" />
          <rect v-if="preview && activeTool === 'rect'" :x="preview.x" :y="preview.y" :width="preview.w" :height="preview.h" stroke="#3b82f6" stroke-width="2" stroke-dasharray="4,4" fill="transparent" />
          <ellipse v-if="preview && activeTool === 'ellipse'" :cx="preview.cx" :cy="preview.cy" :rx="preview.rx" :ry="preview.ry" stroke="#3b82f6" stroke-width="2" stroke-dasharray="4,4" fill="transparent" />

          <!-- Lasso Rect -->
          <rect v-if="lassoRect" :x="lassoRect.x" :y="lassoRect.y" :width="lassoRect.w" :height="lassoRect.h" fill="rgba(59,130,246,0.08)" stroke="#3b82f6" stroke-width="1" stroke-dasharray="2,3" />

          <!-- Ruler calibration preview -->
          <g v-if="activeTool === 'ruler' && rulerPoints.length > 0" style="pointer-events:none;">
            <circle :cx="rulerPoints[0].x" :cy="rulerPoints[0].y" r="5" fill="#f59e0b" stroke="#fff" stroke-width="1.5" />
            <line v-if="rulerPoints.length === 2"
              :x1="rulerPoints[0].x" :y1="rulerPoints[0].y"
              :x2="rulerPoints[1].x" :y2="rulerPoints[1].y"
              stroke="#f59e0b" stroke-width="2" stroke-dasharray="6,4" />
            <circle v-if="rulerPoints.length === 2" :cx="rulerPoints[1].x" :cy="rulerPoints[1].y" r="5" fill="#f59e0b" stroke="#fff" stroke-width="1.5" />
          </g>

          <!-- Scale bar -->
          <g v-if="scalePixelsPerMeter > 0" style="pointer-events:none;" :transform="`translate(${-panOffset.x + 16}, ${stageSize.height - panOffset.y - 28})`">
            <rect x="-4" y="-16" :width="scaleBarWidth + 8" height="28" rx="4" fill="rgba(0,0,0,0.5)" />
            <text :x="scaleBarWidth / 2" y="-5" fill="white" font-size="9" font-weight="600" text-anchor="middle" dominant-baseline="auto">{{ scaleBarLabel }}</text>
            <line x1="0" y1="6" :x2="scaleBarWidth" y2="6" stroke="white" stroke-width="2" stroke-linecap="round" />
            <line x1="0" y1="2" x2="0" y2="10" stroke="white" stroke-width="1.5" />
            <line :x1="scaleBarWidth" y1="2" :x2="scaleBarWidth" y2="10" stroke="white" stroke-width="1.5" />
          </g>

          <!-- Notes -->
          <g v-for="el in elementsWithNotes" :key="'note-'+el.id" :transform="`translate(${el._noteX}, ${el._noteY})`" style="pointer-events: none;">
            <polygon points="-6,0 6,0 0,-6" fill="rgba(30,30,30,0.75)" />
            <rect x="-10" y="0" width="100" height="24" fill="rgba(30,30,30,0.75)" rx="3" />
            <text x="-4" y="16" fill="#e5e7eb" font-size="11" font-family="sans-serif">{{ el.notes }}</text>
          </g>
        </svg>
      </div>

      <!-- Inline Text Editor -->
      <textarea
        v-if="textEditNode"
        ref="textareaRef"
        v-model="textEditValue"
        class="absolute z-30 bg-popover/90 border border-primary text-popover-foreground p-1 resize-none outline-none rounded text-sm shadow-md"
        :style="textEditStyle"
        @blur="commitTextEdit"
        @keydown.enter.prevent="commitTextEdit"
        @keydown.escape="cancelTextEdit"
      />

  </div>

  <!-- Properties Dialog -->
  <Dialog :open="propertiesOpen && !!selectedElement" @update:open="val => { if (!val) { propertiesOpen = false; selectedIds.value = new Set() } }">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>
          <!-- Kanal: Nummer prominent im Titel -->
          <template v-if="selectedElement?.type === 'channel'">
            Kanal {{ channelInfo?.channel }}
          </template>
          <template v-else>
            {{ selectedElement?.type === 'bar' && barForEl(selectedElement) ? barForEl(selectedElement).name : selectedElement?.type === 'tower' && towerForEl(selectedElement) ? towerForEl(selectedElement).name : (selectedElement ? typeLabel(selectedElement.type) : '') }}
          </template>
        </DialogTitle>
      </DialogHeader>

      <DialogBody v-if="selectedElement">
        <!-- Tower info -->
        <template v-if="selectedElement.type === 'tower'">
          <template v-if="towerForEl(selectedElement)">
            <div class="flex flex-col gap-1">
              <div v-if="towerForEl(selectedElement).stage_area" class="text-sm text-muted-foreground">{{ towerForEl(selectedElement).stage_area }}</div>
              <div class="text-sm text-muted-foreground">{{ filledSlotsLabel(selectedElement) }}</div>
            </div>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="slot in (towerForEl(selectedElement).slots ?? []).filter(s => s.channel_id)"
                :key="slot.id"
                class="flex items-center justify-center w-10 h-10 rounded-full bg-white text-black font-bold text-sm shrink-0"
              >
                {{ props.channels.find(c => c.id === slot.channel_id)?.channel ?? '?' }}
              </div>
            </div>
          </template>
        </template>

        <!-- Bar info -->
        <template v-if="selectedElement.type === 'bar'">
          <template v-if="barForEl(selectedElement)">
            <div class="flex flex-col gap-1">
              <div v-if="barForEl(selectedElement).zug_nr" class="text-sm text-muted-foreground">Zug {{ barForEl(selectedElement).zug_nr }}</div>
              <div class="text-sm text-muted-foreground">{{ fixturesLabel(selectedElement) }}</div>
            </div>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="fixture in barForEl(selectedElement).fixtures ?? []"
                :key="fixture.id"
                class="flex items-center justify-center w-10 h-10 rounded-full bg-white text-black font-bold text-sm shrink-0"
              >
                {{ props.channels.find(c => c.id === fixture.channel_id)?.channel ?? '?' }}
              </div>
            </div>
          </template>
        </template>

        <!-- Channel info -->
        <template v-if="selectedElement.type === 'channel'">
          <div v-if="channelInfo" class="flex flex-col gap-1 text-sm text-muted-foreground">
            <div v-if="channelInfo.device">{{ channelInfo.device }}</div>
            <div v-if="channelInfo.position">{{ channelInfo.position }}</div>
            <div v-if="channelInfo.address">{{ channelInfo.address }}</div>
          </div>
        </template>

        <!-- Text editing -->
        <template v-if="selectedElement.type === 'text'">
          <div class="flex flex-col gap-2">
            <Input v-model="selectedElement.text" type="text" placeholder="Text…" @input="emitChange" />
            <div class="flex items-center gap-2">
              <Input v-model.number="selectedElement.fontSize" type="number" min="6" max="200" class="w-20" @input="emitChange" />
              <Button size="sm" :variant="selectedElement.fontStyle === 'bold' ? 'default' : 'ghost'" @click="toggleFontStyle(selectedElement)" class="font-bold">B</Button>
              <input type="color" :value="selectedElement.color || '#9ca3af'" @input="e => { selectedElement.color = e.target.value; emitChange() }" class="w-9 h-9 rounded-xl cursor-pointer bg-transparent border border-border p-0.5" />
            </div>
          </div>
        </template>

        <!-- Stroke/fill (line/rect/ellipse) -->
        <template v-if="['line','rect','ellipse'].includes(selectedElement.type)">
          <div class="flex items-center gap-3">
            <input type="color" :value="selectedElement.color || '#6b7280'" @input="e => { selectedElement.color = e.target.value; emitChange() }" class="w-9 h-9 rounded-xl cursor-pointer bg-transparent border border-border p-0.5" />
            <span class="text-sm text-muted-foreground flex-1">Farbe</span>
            <Input v-model.number="selectedElement.strokeWidth" type="number" min="1" max="20" class="w-20" @input="emitChange" />
          </div>
          <div v-if="selectedElement.type !== 'line'" class="flex items-center gap-3">
            <input type="color" :value="selectedElement.fill === 'transparent' || !selectedElement.fill ? '#000000' : selectedElement.fill" @input="e => { selectedElement.fill = e.target.value; emitChange() }" class="w-9 h-9 rounded-xl cursor-pointer bg-transparent border border-border p-0.5" />
            <span class="text-sm text-muted-foreground flex-1">Füllung</span>
            <Button variant="outline" size="sm" @click="toggleFill(selectedElement)">
              {{ selectedElement.fill && selectedElement.fill !== 'transparent' ? 'Transparent' : 'Füllen' }}
            </Button>
          </div>
        </template>


        <!-- Notiz -->
        <div v-if="selectedElement.type !== 'text'" class="flex flex-col gap-2 pt-2 border-t border-border">
          <Label>Notiz</Label>
          <textarea
            v-model="selectedElement.notes"
            placeholder="Notiz hinzufügen…"
            rows="2"
            class="w-full text-sm text-foreground bg-card border border-input rounded-xl px-4 py-3 resize-none outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
            @input="emitChange"
          />
        </div>
      </DialogBody>

      <DialogFooter v-if="selectedElement" class="justify-between">
        <!-- Links: Löschen -->
        <Button variant="ghost" class="text-destructive hover:text-destructive hover:bg-destructive/10" @click="deleteSelected">
          <Trash2 class="size-4" />Löschen
        </Button>
        <!-- Rechts: Aktion -->
        <div class="flex gap-2">
          <Button v-if="selectedElement.type === 'channel'" variant="outline" @click="jumpToChannel">→ Zum Kanal</Button>
          <Button v-else-if="selectedElement.type === 'bar'" variant="outline" @click="emit('open-bar', selectedElement.barId)">Bearbeiten</Button>
          <Button v-else-if="selectedElement.type === 'tower'" variant="outline" @click="emit('open-tower', selectedElement.towerId)">Bearbeiten</Button>
          <Button v-else variant="outline" @click="duplicateSelected"><Copy class="size-4" />Duplizieren</Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Multi-select Dialog -->
  <Dialog :open="selectedIds.size > 1" @update:open="val => { if (!val) selectedIds = new Set() }">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader hide-close>
        <DialogTitle>{{ selectedIds.size }} Elemente ausgewählt</DialogTitle>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" @click="selectedIds = new Set()">Abbrechen</Button>
        <Button variant="destructive" @click="deleteSelected">
          <Trash2 class="size-4" />Löschen
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

    <div class="absolute top-2 left-15 z-20 flex items-center gap-2 bg-background/80 backdrop-blur border border-border rounded p-1">
      <Button size="sm" :variant="showGrid ? 'default' : 'ghost'" @click="showGrid = !showGrid" class="h-7 px-2 text-xs" title="Gitter anzeigen (G)">Gitter</Button>
      <Button size="sm" :variant="snapToGrid ? 'default' : 'ghost'" @click="snapToGrid = !snapToGrid" class="h-7 px-2 text-xs" title="Am Gitter einrasten">Einrasten</Button>
    </div>
  </div>

  <!-- Reassign Dialog -->
  <Dialog :open="!!reassignTargetId" @update:open="val => { if (!val) reassignTargetId = null }">
    <DialogContent class="sm:max-w-lg flex flex-col max-h-[80vh]">
      <DialogHeader><DialogTitle>Kanal neu zuweisen</DialogTitle></DialogHeader>
      <DialogBody class="flex-1 overflow-y-auto">
        <Input v-model="channelSearch" placeholder="Suchen…" autofocus />
        <div class="flex flex-col gap-1">
          <Button v-for="ch in filteredChannels" :key="ch.channel" variant="ghost" :disabled="usedChannels.includes(ch.channel)" @click="reassignChannel(ch)" class="w-full justify-start h-auto py-2" :class="usedChannels.includes(ch.channel) && 'opacity-50'">
            <div class="text-left"><div class="font-semibold">{{ ch.channel }}</div><div class="text-xs text-muted-foreground">{{ ch.device }}</div></div>
          </Button>
        </div>
      </DialogBody>
      <DialogFooter><Button variant="outline" @click="reassignTargetId = null">Abbrechen</Button></DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Tower Picker Dialog -->
  <Dialog :open="showTowerPicker" @update:open="val => { if (!val) showTowerPicker = false }">
    <DialogContent class="sm:max-w-lg flex flex-col max-h-[80vh]">
      <DialogHeader><DialogTitle>Gassenturm platzieren</DialogTitle></DialogHeader>
      <DialogBody class="flex-1 overflow-y-auto">
        <div class="flex flex-col gap-1">
          <Button v-for="tower in props.towers" :key="tower.id" variant="ghost" :disabled="towerAlreadyPlaced(tower.id)" @click="placeTowerNode(tower)" class="w-full justify-start h-auto py-2" :class="towerAlreadyPlaced(tower.id) && 'opacity-40'">
            <div class="text-left"><div class="font-semibold">{{ tower.name }}</div><div class="text-xs text-muted-foreground">{{ tower.stage_area }}{{ tower.side ? ' · ' + tower.side : '' }}</div></div>
          </Button>
          <div v-if="!props.towers.length" class="text-sm text-muted-foreground py-4 text-center">Noch keine Gassentürme angelegt</div>
        </div>
      </DialogBody>
      <DialogFooter><Button variant="outline" @click="showTowerPicker = false">Abbrechen</Button></DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Bar Picker Dialog -->
  <Dialog :open="showBarPicker" @update:open="val => { if (!val) showBarPicker = false }">
    <DialogContent class="sm:max-w-lg flex flex-col max-h-[80vh]">
      <DialogHeader><DialogTitle>Zugstange platzieren</DialogTitle></DialogHeader>
      <DialogBody class="flex-1 overflow-y-auto">
        <div class="flex flex-col gap-1">
          <Button v-for="bar in props.bars" :key="bar.id" variant="ghost" :disabled="barAlreadyPlaced(bar.id)" @click="placeBarNode(bar)" class="w-full justify-start h-auto py-2" :class="barAlreadyPlaced(bar.id) && 'opacity-40'">
            <div class="text-left"><div class="font-semibold">{{ bar.name }}</div><div class="text-xs text-muted-foreground">{{ bar.length_cm }} cm{{ bar.zug_nr ? ' · Zug ' + bar.zug_nr : '' }}</div></div>
          </Button>
          <div v-if="!props.bars.length" class="text-sm text-muted-foreground py-4 text-center">Noch keine Zugstangen angelegt</div>
        </div>
      </DialogBody>
      <DialogFooter><Button variant="outline" @click="showBarPicker = false">Abbrechen</Button></DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Ruler Distance Dialog -->
  <Dialog :open="showRulerDialog" @update:open="val => { if (!val) cancelRuler() }">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader><DialogTitle>Strecke eingeben</DialogTitle></DialogHeader>
      <DialogBody>
        <p class="text-sm text-muted-foreground mb-3">Wie lang ist die markierte Strecke in Metern?</p>
        <Input v-model="rulerDistanceInput" type="text" inputmode="decimal" placeholder="z. B. 6" autofocus @keydown.enter="commitRuler" />
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" @click="cancelRuler">Abbrechen</Button>
        <Button @click="commitRuler">Übernehmen</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Channel Picker Dialog -->
  <Dialog :open="showChannelPicker" @update:open="val => { if (!val) showChannelPicker = false }">
    <DialogContent class="sm:max-w-lg flex flex-col max-h-[80vh]">
      <DialogHeader><DialogTitle>Kanal wählen</DialogTitle></DialogHeader>
      <DialogBody class="flex-1 overflow-y-auto">
        <Input v-model="channelSearch" placeholder="Suchen…" autofocus />
        <div class="flex flex-col gap-1">
          <Button v-for="ch in filteredChannels" :key="ch.channel" variant="ghost" :disabled="usedChannels.includes(ch.channel)" @click="placeChannelCircle(ch)" class="w-full justify-start h-auto py-2" :class="usedChannels.includes(ch.channel) && 'opacity-50'">
            <div class="text-left"><div class="font-semibold">{{ ch.channel }}</div><div class="text-xs text-muted-foreground">{{ ch.device }}</div></div>
          </Button>
        </div>
      </DialogBody>
      <DialogFooter><Button variant="outline" @click="showChannelPicker = false">Abbrechen</Button></DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { uuid } from '../utils/uuid.js'
import {
  Copy, MousePointer2, Hand, Minus, Square, Circle, Type, CircleDot,
  Upload, ImageOff, Download, Undo2, Redo2, Trash2, Layers, AlignJustify, Ruler
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

import ToolBtn from '@/components/ui/ToolBtn.vue'
import PanelBtn from '@/components/ui/PanelBtn.vue'

const props = defineProps({
  imageUrl: { type: String, default: null },
  initialCanvasData: { type: String, default: null },
  channels: { type: Array, default: () => [] },
  towers: { type: Array, default: () => [] },
  bars: { type: Array, default: () => [] },
})
const emit = defineEmits(['change', 'jump-to-channel', 'upload-image', 'delete-image', 'snapshot', 'open-tower', 'open-bar'])

const activeTool = ref('select')
const elements = ref([])
const selectedIds = ref(new Set())
const preview = ref(null)
const drawStart = ref(null)
const showChannelPicker = ref(false)
const channelPickerPos = ref({ x: 0, y: 0 })
const channelSearch = ref('')
const showTowerPicker = ref(false)
const towerPickerPos = ref({ x: 0, y: 0 })
const showBarPicker = ref(false)
const barPickerPos = ref({ x: 0, y: 0 })
const reassignTargetId = ref(null)
const svgRef = ref(null)
const containerEl = ref(null)
const imageUploadInput = ref(null)
const history = ref([])
const historyIndex = ref(-1)
const lassoRect = ref(null)
const pendingDirectionId = ref(null)

const bgImage = ref(null)
const bgImageSrc = ref('')
const containerSize = ref({ width: 1200, height: 800 })
const stageSize = ref({ width: 1200, height: 800 })

const stageScale = computed(() => {
  const sx = containerSize.value.width / stageSize.value.width
  const sy = containerSize.value.height / stageSize.value.height
  return Math.min(sx, sy, 1)
})
const containerOffsetX = computed(() => Math.round((containerSize.value.width - stageSize.value.width * stageScale.value) / 2))
const containerOffsetY = computed(() => Math.round((containerSize.value.height - stageSize.value.height * stageScale.value) / 2))

const showGrid = ref(false)
const snapToGrid = ref(false)
const GRID_SIZE = 30
const panOffset = ref({ x: 0, y: 0 })
const isPanning = ref(false)
const panStart = ref(null)
const spaceHeld = ref(false)
const clipboard = ref(null)
const textEditNode = ref(null)
const textEditValue = ref('')
const textEditStyle = ref({})
const textareaRef = ref(null)

const selectedId = computed(() => selectedIds.value.size === 1 ? [...selectedIds.value][0] : null)
const selectedElement = computed(() => elements.value.find(e => e.id === selectedId.value))
const usedChannels = computed(() => elements.value.filter(e => e.type === 'channel').map(e => e.channel))
const channelInfo = computed(() => {
  if (!selectedElement.value || selectedElement.value.type !== 'channel') return null
  return props.channels.find(ch => ch.channel === selectedElement.value.channel)
})

const NOTE_GAP = 3
const NOTE_CHANNEL_RADIUS = 14
const NOTE_TEXT_BASELINE = 10
const elementsWithNotes = computed(() => {
  return elements.value.filter(el => el.type !== 'text' && el.notes && el.notes.trim()).map(el => {
    let x, y
    if (el.type === 'line') {
      const mx = (el.x1 + el.x2) / 2, my = (el.y1 + el.y2) / 2
      const dx = el.x2 - el.x1, dy = el.y2 - el.y1
      const len = Math.hypot(dx, dy) || 1
      x = mx + (-dy / len) * NOTE_GAP
      y = my + (dx / len) * NOTE_GAP
    } else if (el.type === 'rect') { x = el.x + el.w / 2; y = el.y + el.h + NOTE_GAP } 
    else if (el.type === 'ellipse') { x = el.x; y = el.y + el.ry + NOTE_GAP } 
    else if (el.type === 'channel') { x = el.x; y = el.y + NOTE_CHANNEL_RADIUS + NOTE_GAP } 
    else { x = el.x; y = el.y + NOTE_TEXT_BASELINE + NOTE_GAP }
    return { ...el, _noteX: x, _noteY: y }
  })
})

const filteredChannels = computed(() => {
  const q = channelSearch.value.toLowerCase()
  return props.channels.filter(ch => ch.channel.toLowerCase().includes(q) || (ch.device && ch.device.toLowerCase().includes(q)))
})

const isElementDragging = ref(false)
const isResizing = ref(false)
const isArrowRotating = ref(false)
const hoveredId = ref(null)
const propertiesOpen = ref(false)

const rulerPoints = ref([])
const scalePixelsPerMeter = ref(0)
const showRulerDialog = ref(false)
const rulerDistanceInput = ref('')

const scaleBarWidth = computed(() => {
  if (scalePixelsPerMeter.value <= 0) return 0
  const candidates = [0.25, 0.5, 1, 2, 5, 10, 20, 50]
  const target = 80 / scalePixelsPerMeter.value
  const m = candidates.reduce((a, b) => Math.abs(a - target) < Math.abs(b - target) ? a : b)
  return m * scalePixelsPerMeter.value
})
const scaleBarLabel = computed(() => {
  if (scalePixelsPerMeter.value <= 0) return ''
  const candidates = [0.25, 0.5, 1, 2, 5, 10, 20, 50]
  const target = 80 / scalePixelsPerMeter.value
  const m = candidates.reduce((a, b) => Math.abs(a - target) < Math.abs(b - target) ? a : b)
  return m >= 1 ? `${m} m` : `${Math.round(m * 100)} cm`
})


function towerForEl(el) { return props.towers.find(t => t.id === el.towerId) ?? null }
function filledSlotsLabel(el) {
  const t = towerForEl(el)
  if (!t) return ''
  const filled = (t.slots ?? []).filter(s => s.channel_id).length
  return `${filled}/${t.slot_count} Slots`
}
function barForEl(el) { return props.bars.find(b => b.id === el.barId) ?? null }
function fixturesLabel(el) {
  const b = barForEl(el)
  if (!b) return ''
  return `${(b.fixtures ?? []).length} Scheinwerfer`
}
function fixtureXOffset(positionCm, lengthCm, widthPx) {
  const len = lengthCm || 600
  return ((positionCm + len / 2) / len) * widthPx
}
function channelNrById(channelId) {
  return props.channels.find(c => c.id === channelId)?.channel ?? '?'
}
function pillW(_channel) { return 62 }
function typeLabel(type) { return { line: 'Linie', rect: 'Rechteck', ellipse: 'Ellipse', text: 'Text', channel: 'Kanal', tower: 'Gassenturm', bar: 'Zugstange' }[type] || type }

function getArrowPoints(channel, rot) {
  const rad = (rot || 0) * Math.PI / 180
  const w = pillW(channel)
  const r = 18
  const flatW = w / 2 - r

  const dx = Math.cos(rad)
  const dy = Math.sin(rad)

  let bx = 0, by = 0
  if (Math.abs(dy) > 0.001) {
    const yEdge = dy > 0 ? r : -r
    const xIntersect = yEdge * dx / dy
    if (xIntersect >= -flatW && xIntersect <= flatW) {
      bx = xIntersect
      by = yEdge
    }
  }

  if (bx === 0 && by === 0) {
    const cx = dx > 0 ? flatW : -flatW
    const B = -2 * dx * cx
    const C = cx * cx - r * r
    const disc = B * B - 4 * C
    if (disc >= 0) {
      const t = (-B + Math.sqrt(disc)) / 2
      bx = t * dx
      by = t * dy
    }
  }

  const len = 40
  return { x1: bx, y1: by, x2: bx + dx * len, y2: by + dy * len }
}

function fitToContainer() { panOffset.value = { x: 0, y: 0 } }

watch(() => props.imageUrl, (url) => {
  if (!url) { bgImage.value = null; bgImageSrc.value = ''; return }
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    const MAX = 2000
    const scale = Math.min(1, MAX / img.naturalWidth, MAX / img.naturalHeight)
    stageSize.value = { width: Math.round(img.naturalWidth * scale), height: Math.round(img.naturalHeight * scale) }
    bgImage.value = img
    // We create a canvas to get a base64 version so SVG doesn't throw SecurityError on toDataURL
    const cvs = document.createElement('canvas')
    cvs.width = img.naturalWidth; cvs.height = img.naturalHeight;
    cvs.getContext('2d').drawImage(img, 0, 0)
    bgImageSrc.value = cvs.toDataURL()
    nextTick(fitToContainer)
  }
  img.src = url
}, { immediate: true })

const gridLeft = computed(() => -panOffset.value.x)
const gridTop = computed(() => -panOffset.value.y)
const gridRight = computed(() => gridLeft.value + stageSize.value.width / stageScale.value)
const gridBottom = computed(() => gridTop.value + stageSize.value.height / stageScale.value)
const gridVerticalLines = computed(() => {
  const lines = [], start = Math.floor(gridLeft.value / GRID_SIZE) * GRID_SIZE
  for (let x = start; x <= gridRight.value; x += GRID_SIZE) lines.push(x)
  return lines
})
const gridHorizontalLines = computed(() => {
  const lines = [], start = Math.floor(gridTop.value / GRID_SIZE) * GRID_SIZE
  for (let y = start; y <= gridBottom.value; y += GRID_SIZE) lines.push(y)
  return lines
})

function snap(val) { return snapToGrid.value ? Math.round(val / GRID_SIZE) * GRID_SIZE : val }

function getPointerPos(e) {
  if (!svgRef.value) return { x: 0, y: 0 }
  const rect = svgRef.value.getBoundingClientRect()
  return {
    x: (e.clientX - rect.left) / stageScale.value,
    y: (e.clientY - rect.top) / stageScale.value
  }
}

function getBounds(el) {
  if (el.type === 'rect') return { x: el.x, y: el.y, w: el.w, h: el.h }
  if (el.type === 'ellipse') return { x: el.x - el.rx, y: el.y - el.ry, w: el.rx * 2, h: el.ry * 2 }
  if (el.type === 'text') return { x: el.x - 5, y: el.y - 5, w: (el.fontSize||16)*5, h: (el.fontSize||16)+10 }
  if (el.type === 'tower') return { x: el.x, y: el.y, w: el.w || 90, h: el.h || 54 }
  if (el.type === 'bar') return { x: el.x, y: el.y, w: el.w || 160, h: el.h || 28 }
  return { x: 0, y: 0, w: 0, h: 0 }
}

function getTransform(el) {
  const rot = el.rotation || 0
  if (!rot) {
    if (el.type === 'channel') return `translate(${el.x}, ${el.y})`
    return ''
  }
  let cx = 0, cy = 0
  if (el.type === 'line') { cx = (el.x1 + el.x2) / 2; cy = (el.y1 + el.y2) / 2 } 
  else if (el.type === 'rect') { cx = el.x + el.w / 2; cy = el.y + el.h / 2 } 
  else if (el.type === 'ellipse') { cx = el.x; cy = el.y } 
  else if (el.type === 'text') { cx = el.x; cy = el.y } 
  else if (el.type === 'channel') {
    return `translate(${el.x}, ${el.y})`
  }
  return `rotate(${rot} ${cx} ${cy})`
}

function onNodeMouseDown(id, e) {
  if (activeTool.value !== 'select') return
  e.stopPropagation()
  if (e.shiftKey) {
    const s = new Set(selectedIds.value)
    s.has(id) ? s.delete(id) : s.add(id)
    selectedIds.value = s
  } else if (!selectedIds.value.has(id)) {
    selectedIds.value = new Set([id])
    propertiesOpen.value = false
  }

  isElementDragging.value = true
  const pos = getPointerPos(e)
  drawStart.value = pos

  // Save initial state for dragging
  clipboard.value = [...selectedIds.value].map(sid => JSON.parse(JSON.stringify(elements.value.find(x => x.id === sid))))
}

function onNodeDblClick(id) {
  if (activeTool.value !== 'select') return
  selectedIds.value = new Set([id])
  propertiesOpen.value = true
}

let resizeObj = null
function startResizeLine(id, point, e) {
  e.stopPropagation()
  isResizing.value = true
  resizeObj = { id, point }
}
function startResizeRectEllipse(id, e) {
  e.stopPropagation()
  isResizing.value = true
  const el = elements.value.find(x => x.id === id)
  resizeObj = { id, initX: el.x, initY: el.y }
}

function onContainerMouseDown(e) {
  const pos = getPointerPos(e)
  if (activeTool.value === 'pan' || spaceHeld.value) {
    isPanning.value = true
    panStart.value = { mx: e.clientX, my: e.clientY, ox: panOffset.value.x, oy: panOffset.value.y }
    return
  }
  if (activeTool.value === 'select') {
    if (!e.shiftKey) selectedIds.value = new Set()
    drawStart.value = pos
    lassoRect.value = null
    return
  }
  if (['line', 'rect', 'ellipse'].includes(activeTool.value)) {
    drawStart.value = pos
    preview.value = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y, x: pos.x, y: pos.y, w: 0, h: 0, cx: pos.x, cy: pos.y, rx: 0, ry: 0 }
  } else if (activeTool.value === 'channel' || activeTool.value === 'text') {
    drawStart.value = pos
  }
}

function onContainerMouseMove(e) {
  if (isPanning.value && panStart.value) {
    const s = stageScale.value
    panOffset.value = { x: panStart.value.ox + (e.clientX - panStart.value.mx) / s, y: panStart.value.oy + (e.clientY - panStart.value.my) / s }
    return
  }
  
  const pos = getPointerPos(e)

  if (activeTool.value === 'channel-direction' && pendingDirectionId.value) {
    const el = elements.value.find(x => x.id === pendingDirectionId.value)
    if (el) el.rotation = Math.atan2(pos.y - el.y, pos.x - el.x) * 180 / Math.PI
    return
  }

  if (isResizing.value && resizeObj) {
    const el = elements.value.find(x => x.id === resizeObj.id)
    if (el.type === 'line') {
      if (resizeObj.point === 1) { el.x1 = pos.x; el.y1 = pos.y }
      else { el.x2 = pos.x; el.y2 = pos.y }
    } else if (el.type === 'rect') {
      el.w = Math.max(5, pos.x - resizeObj.initX)
      el.h = Math.max(5, pos.y - resizeObj.initY)
    } else if (el.type === 'ellipse') {
      el.rx = Math.max(3, pos.x - resizeObj.initX)
      el.ry = Math.max(3, pos.y - resizeObj.initY)
    }
    return
  }

  if (isElementDragging.value && drawStart.value) {
    const dx = pos.x - drawStart.value.x
    const dy = pos.y - drawStart.value.y
    clipboard.value.forEach(init => {
      const el = elements.value.find(x => x.id === init.id)
      if (!el) return
      if (el.type === 'line') { el.x1 = init.x1 + dx; el.y1 = init.y1 + dy; el.x2 = init.x2 + dx; el.y2 = init.y2 + dy }
      else { el.x = init.x + dx; el.y = init.y + dy }
    })
    return
  }

  if (!drawStart.value) return

  if (activeTool.value === 'select') {
    lassoRect.value = { x: Math.min(pos.x, drawStart.value.x), y: Math.min(pos.y, drawStart.value.y), w: Math.abs(pos.x - drawStart.value.x), h: Math.abs(pos.y - drawStart.value.y) }
  } else if (activeTool.value === 'line') {
    preview.value = { ...preview.value, x2: pos.x, y2: pos.y }
  } else if (activeTool.value === 'rect') {
    preview.value = { x: Math.min(drawStart.value.x, pos.x), y: Math.min(drawStart.value.y, pos.y), w: Math.abs(pos.x - drawStart.value.x), h: Math.abs(pos.y - drawStart.value.y) }
  } else if (activeTool.value === 'ellipse') {
    preview.value = { cx: (drawStart.value.x + pos.x) / 2, cy: (drawStart.value.y + pos.y) / 2, rx: Math.abs(pos.x - drawStart.value.x) / 2, ry: Math.abs(pos.y - drawStart.value.y) / 2 }
  }
}

function onContainerMouseUp(e) {
  if (activeTool.value === 'channel-direction' && pendingDirectionId.value) {
    const el = elements.value.find(x => x.id === pendingDirectionId.value)
    if (el) { el.rotation = Math.atan2(getPointerPos(e).y - el.y, getPointerPos(e).x - el.x) * 180 / Math.PI; emitChange() }
    pendingDirectionId.value = null; activeTool.value = 'select'
    return
  }
  if (isPanning.value) { isPanning.value = false; panStart.value = null; return }
  if (isResizing.value) { 
    isResizing.value = false; resizeObj = null
    elements.value.forEach(el => {
      if(el.type === 'line'){ el.x1=snap(el.x1); el.y1=snap(el.y1); el.x2=snap(el.x2); el.y2=snap(el.y2) }
      else if (el.type === 'rect') { el.w=snap(el.w); el.h=snap(el.h) }
      else if (el.type === 'ellipse') { el.rx=snap(el.rx); el.ry=snap(el.ry) }
    })
    emitChange()
    return
  }
  if (isElementDragging.value) {
    isElementDragging.value = false
    const upPos = getPointerPos(e)
    const dragDist = drawStart.value ? Math.hypot(upPos.x - drawStart.value.x, upPos.y - drawStart.value.y) : 999
    elements.value.forEach(el => {
      if(!selectedIds.value.has(el.id)) return
      if(el.type === 'line'){ el.x1=snap(el.x1); el.y1=snap(el.y1); el.x2=snap(el.x2); el.y2=snap(el.y2) }
      else { el.x=snap(el.x); el.y=snap(el.y) }
    })
    drawStart.value = null
    emitChange()
    if (dragDist < 5 && selectedIds.value.size === 1) propertiesOpen.value = true
    return
  }

  if (activeTool.value === 'ruler') {
    const pos = getPointerPos(e)
    rulerPoints.value = [...rulerPoints.value, { x: pos.x, y: pos.y }]
    if (rulerPoints.value.length === 2) {
      rulerDistanceInput.value = ''
      showRulerDialog.value = true
    }
    drawStart.value = null
    return
  }

  if (!drawStart.value) return
  const pos = getPointerPos(e)
  const dist = Math.hypot(pos.x - drawStart.value.x, pos.y - drawStart.value.y)

  if (activeTool.value === 'select' && lassoRect.value) {
    const { x, y, w, h } = lassoRect.value
    const inLasso = elements.value.filter(el => {
      let cx, cy
      if (el.type === 'line') { cx = (el.x1 + el.x2) / 2; cy = (el.y1 + el.y2) / 2 }
      else if (el.type === 'rect') { cx = el.x + el.w / 2; cy = el.y + el.h / 2 }
      else { cx = el.x; cy = el.y }
      return cx >= x && cx <= x + w && cy >= y && cy <= y + h
    })
    selectedIds.value = new Set(inLasso.map(e => e.id))
    lassoRect.value = null; drawStart.value = null
    return
  }

  if (dist > 5) {
    if (activeTool.value === 'line') { addElement({ id: uuid(), type: 'line', x1: snap(drawStart.value.x), y1: snap(drawStart.value.y), x2: snap(pos.x), y2: snap(pos.y), rotation: 0, color: '#6b7280', strokeWidth: 2 }); emitChange() }
    else if (activeTool.value === 'rect') { addElement({ id: uuid(), type: 'rect', x: snap(Math.min(drawStart.value.x, pos.x)), y: snap(Math.min(drawStart.value.y, pos.y)), w: snap(Math.abs(pos.x - drawStart.value.x)), h: snap(Math.abs(pos.y - drawStart.value.y)), rotation: 0, color: '#6b7280', strokeWidth: 2, fill: 'transparent' }); emitChange() }
    else if (activeTool.value === 'ellipse') { addElement({ id: uuid(), type: 'ellipse', x: snap((drawStart.value.x + pos.x) / 2), y: snap((drawStart.value.y + pos.y) / 2), rx: snap(Math.abs(pos.x - drawStart.value.x) / 2), ry: snap(Math.abs(pos.y - drawStart.value.y) / 2), rotation: 0, color: '#6b7280', strokeWidth: 2, fill: 'transparent' }); emitChange() }
    activeTool.value = 'select'
  } else {
    if (activeTool.value === 'channel') {
      channelPickerPos.value = { x: snap(drawStart.value.x), y: snap(drawStart.value.y) }
      channelSearch.value = ''; showChannelPicker.value = true
    } else if (activeTool.value === 'text') {
      addElement({ id: uuid(), type: 'text', x: snap(drawStart.value.x), y: snap(drawStart.value.y), text: 'Text', rotation: 0, color: '#9ca3af', fontSize: 16, fontStyle: 'normal' })
      emitChange(); activeTool.value = 'select'
    } else if (activeTool.value === 'select') {
      selectedIds.value = new Set()
    }
  }

  drawStart.value = null; preview.value = null; lassoRect.value = null
}

function resetView() { if (bgImage.value) fitToContainer(); else panOffset.value = { x: 0, y: 0 } }

function onContainerDblClick(e) {
  if (activeTool.value !== 'select') return
  if (selectedIds.value.size === 1) {
    const el = elements.value.find(x => x.id === [...selectedIds.value][0])
    if (el?.type === 'text') {
      textEditNode.value = el
      textEditValue.value = el.text
      const CTM = svgRef.value.getScreenCTM()
      const box = containerEl.value.getBoundingClientRect()
      textEditStyle.value = {
        top: (CTM.f + el.y * CTM.d - box.top) + 'px',
        left: (CTM.e + el.x * CTM.a - box.left) + 'px',
        minWidth: '80px', fontSize: (el.fontSize || 16) + 'px', transform: `rotate(${el.rotation || 0}deg)`, transformOrigin: '0 0'
      }
      nextTick(() => textareaRef.value?.focus())
    }
  }
}

function commitTextEdit() {
  if (!textEditNode.value) return
  const el = elements.value.find(e => e.id === textEditNode.value.id)
  if (el) { el.text = textEditValue.value; emitChange() }
  textEditNode.value = null
}
function cancelTextEdit() { textEditNode.value = null }

function copySelected() {
  if (selectedIds.value.size === 0) return
  clipboard.value = elements.value.filter(e => selectedIds.value.has(e.id)).map(e => ({ ...e }))
}
function pasteClipboard() {
  if (!clipboard.value?.length) return
  const newIds = new Set()
  clipboard.value.forEach(el => {
    const newEl = { ...el, id: uuid(), x: (el.x ?? el.x1 ?? 0) + 20, y: (el.y ?? el.y1 ?? 0) + 20 }
    if (el.x1 !== undefined) { newEl.x1 = el.x1 + 20; newEl.y1 = el.y1 + 20; newEl.x2 = el.x2 + 20; newEl.y2 = el.y2 + 20 }
    elements.value.push(newEl); newIds.add(newEl.id)
  })
  selectedIds.value = newIds; emitChange()
}
function duplicateSelected() { copySelected(); pasteClipboard() }
function addElement(el) { elements.value.push(el) }
function deleteSelected() {
  if (selectedIds.value.size === 0) return
  elements.value = elements.value.filter(e => !selectedIds.value.has(e.id))
  selectedIds.value = new Set(); emitChange()
}
function openTowerPlacer() {
  towerPickerPos.value = { x: snap(stageSize.value.width / 2 - panOffset.value.x), y: snap(stageSize.value.height / 2 - panOffset.value.y) }
  showTowerPicker.value = true
}
function towerAlreadyPlaced(towerId) {
  return elements.value.some(e => e.type === 'tower' && e.towerId === towerId)
}
function placeTowerNode(tower) {
  addElement({ id: uuid(), type: 'tower', x: snap(towerPickerPos.value.x), y: snap(towerPickerPos.value.y), w: 90, h: 54, towerId: tower.id, towerName: tower.name, rotation: 0 })
  showTowerPicker.value = false
  activeTool.value = 'select'
  emitChange()
}

function openBarPlacer() {
  barPickerPos.value = { x: snap(stageSize.value.width / 2 - panOffset.value.x - 80), y: snap(stageSize.value.height / 2 - panOffset.value.y) }
  showBarPicker.value = true
}
function barAlreadyPlaced(barId) {
  return elements.value.some(e => e.type === 'bar' && e.barId === barId)
}
function barWidthPx(lengthCm) {
  if (scalePixelsPerMeter.value > 0) return Math.round((lengthCm / 100) * scalePixelsPerMeter.value)
  return Math.min(Math.max(Math.round(lengthCm / 4), 80), 400)
}
function placeBarNode(bar) {
  const w = barWidthPx(bar.length_cm || 600)
  addElement({ id: uuid(), type: 'bar', x: snap(barPickerPos.value.x - w / 2), y: snap(barPickerPos.value.y), w, h: 28, barId: bar.id, barName: bar.name, rotation: 0 })
  showBarPicker.value = false
  activeTool.value = 'select'
  emitChange()
}

function commitRuler() {
  const normalized = rulerDistanceInput.value.replace(',', '.')
  const meters = parseFloat(normalized)
  if (!isNaN(meters) && meters > 0 && rulerPoints.value.length === 2) {
    const dx = rulerPoints.value[1].x - rulerPoints.value[0].x
    const dy = rulerPoints.value[1].y - rulerPoints.value[0].y
    scalePixelsPerMeter.value = Math.sqrt(dx * dx + dy * dy) / meters
    // Alle platzierten Bars auf neuen Maßstab anpassen, Mitte beibehalten
    elements.value.forEach(el => {
      if (el.type !== 'bar') return
      const bar = props.bars.find(b => b.id === el.barId)
      if (!bar) return
      const oldW = el.w || 160
      const newW = barWidthPx(bar.length_cm || 600)
      el.x = Math.round(el.x + oldW / 2 - newW / 2)
      el.w = newW
    })
    emitChange()
  }
  rulerPoints.value = []
  showRulerDialog.value = false
  activeTool.value = 'select'
}
function cancelRuler() {
  rulerPoints.value = []
  showRulerDialog.value = false
  activeTool.value = 'select'
}

function placeChannelCircle(ch) {
  const id = uuid()
  addElement({ id, type: 'channel', x: channelPickerPos.value.x, y: channelPickerPos.value.y, channel: ch.channel, rotation: 0 })
  showChannelPicker.value = false; pendingDirectionId.value = id; activeTool.value = 'channel-direction'; emitChange()
}
function onImageFileSelected(e) {
  const file = e.target.files?.[0]; if (file) emit('upload-image', file); e.target.value = ''
}
function jumpToChannel() { if (selectedElement.value?.type === 'channel') emit('jump-to-channel', selectedElement.value.channel) }
function openReassignPicker() { if (selectedElement.value?.type === 'channel') { reassignTargetId.value = selectedElement.value.id; channelSearch.value = '' } }
function reassignChannel(ch) {
  const el = elements.value.find(e => e.id === reassignTargetId.value)
  if (el) { el.channel = ch.channel; emitChange() }
  reassignTargetId.value = null
}
function updateRotation(id, deg) { const el = elements.value.find(e => e.id === id); if (el) { el.rotation = deg; emitChange() } }

function startRotationDrag(el, event) {
  event.preventDefault()
  event.stopPropagation()
  const rect = event.currentTarget.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  function onMove(e) {
    const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI + 90
    updateRotation(el.id, Math.round(angle))
  }
  function onUp() {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function startArrowRotateDrag(el, event) {
  event.preventDefault()
  event.stopPropagation()
  isArrowRotating.value = true
  function onMove(e) {
    const pos = getPointerPos(e)
    const angle = Math.atan2(pos.y - el.y, pos.x - el.x) * 180 / Math.PI
    updateRotation(el.id, Math.round(angle))
  }
  function onUp() {
    isArrowRotating.value = false
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

function toggleFontStyle(el) { el.fontStyle = el.fontStyle === 'bold' ? 'normal' : 'bold'; emitChange() }
function toggleFill(el) { el.fill = (el.fill && el.fill !== 'transparent') ? 'transparent' : '#ffffff'; emitChange() }
function exportData() {
  const data = { elements: elements.value }
  if (scalePixelsPerMeter.value > 0) data._scale = scalePixelsPerMeter.value
  return JSON.stringify(data)
}
function parseData(str) {
  if (!str) return
  try {
    const parsed = JSON.parse(str)
    if (Array.isArray(parsed)) {
      elements.value = parsed
    } else {
      elements.value = parsed.elements ?? []
      scalePixelsPerMeter.value = parsed._scale ?? 0
    }
  } catch {}
}

function pushHistory() {
  const snap = exportData()
  let h = history.value.slice(0, historyIndex.value + 1)
  h.push(snap); if (h.length > 100) h = h.slice(-100)
  history.value = h; historyIndex.value = history.value.length - 1
}
async function captureSnapshot() {
  if (!svgRef.value) return null
  const canvas = document.createElement('canvas')
  canvas.width = stageSize.value.width; canvas.height = stageSize.value.height
  const ctx = canvas.getContext('2d')
  if (bgImage.value) ctx.drawImage(bgImage.value, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.8)
}
function undo() {
  if (historyIndex.value <= 0) return
  historyIndex.value--; parseData(history.value[historyIndex.value])
  captureSnapshot().then(snap => emit('change', history.value[historyIndex.value], snap))
}
function redo() {
  if (historyIndex.value >= history.value.length - 1) return
  historyIndex.value++; parseData(history.value[historyIndex.value])
  captureSnapshot().then(snap => emit('change', history.value[historyIndex.value], snap))
}
function emitChange() {
  pushHistory()
  const data = exportData()
  captureSnapshot().then(snap => emit('change', data, snap))
}
function exportPNG() {
  const canvas = document.createElement('canvas')
  canvas.width = stageSize.value.width * 2; canvas.height = stageSize.value.height * 2
  const ctx = canvas.getContext('2d'); ctx.scale(2, 2)
  if (bgImage.value) ctx.drawImage(bgImage.value, 0, 0, stageSize.value.width, stageSize.value.height)
  
  const svg = svgRef.value.cloneNode(true)
  const bgImgNode = svg.querySelector('#bg-image')
  if (bgImgNode) bgImgNode.remove()
  let svgStr = new XMLSerializer().serializeToString(svg)
  if (!svgStr.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) svgStr = svgStr.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"')
  
  const img = new Image()
  img.onload = () => {
    ctx.drawImage(img, 0, 0)
    const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = 'grundriss.png'; a.click()
  }
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr)
}

function isInputFocused() { const el = document.activeElement; return el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || !!el?.isContentEditable }
function handleKeyDown(e) {
  if (isInputFocused()) return
  if (e.key === ' ') { e.preventDefault(); spaceHeld.value = true; return }
  if (!e.ctrlKey && !e.metaKey) {
    if (e.key === 'v' || e.key === 'V') { activeTool.value = 'select'; return }
    if (e.key === 'h' || e.key === 'H') { activeTool.value = 'pan'; return }
    if (e.key === 'l' || e.key === 'L') { activeTool.value = 'line'; return }
    if (e.key === 'r' || e.key === 'R') { activeTool.value = 'rect'; return }
    if (e.key === 'e' || e.key === 'E') { activeTool.value = 'ellipse'; return }
    if (e.key === 't' || e.key === 'T') { activeTool.value = 'text'; return }
    if (e.key === 'c' && activeTool.value !== 'select') { activeTool.value = 'channel'; return }
    if (e.key === 'g' || e.key === 'G') { showGrid.value = !showGrid.value; return }
    if (e.key === 'f' || e.key === 'F') { resetView(); return }
    if (e.key === 'Escape') { if(activeTool.value==='channel-direction') pendingDirectionId.value=null; activeTool.value = 'select'; selectedIds.value = new Set(); return }
    if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelected(); return }
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key) && selectedIds.value.size > 0) {
      e.preventDefault(); const step = e.shiftKey ? 10 : 1
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
      elements.value.forEach(el => {
        if (!selectedIds.value.has(el.id)) return
        if (el.type === 'line') { el.x1 += dx; el.y1 += dy; el.x2 += dx; el.y2 += dy } else { el.x = (el.x || 0) + dx; el.y = (el.y || 0) + dy }
      })
      emitChange(); return
    }
  }
  if ((e.ctrlKey || e.metaKey)) {
    if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return }
    if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); return }
    if (e.key === 'c') { e.preventDefault(); copySelected(); return }
    if (e.key === 'v') { e.preventDefault(); pasteClipboard(); return }
    if (e.key === 'd') { e.preventDefault(); duplicateSelected(); return }
    if (e.key === 'a') { e.preventDefault(); selectedIds.value = new Set(elements.value.map(e => e.id)); return }
    if (e.key === '0') { e.preventDefault(); resetView(); return }
  }
}
function handleKeyUp(e) { if (e.key === ' ') spaceHeld.value = false }

let resizeObserver = null
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  if (containerEl.value) {
    resizeObserver = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) containerSize.value = { width, height }
    })
    resizeObserver.observe(containerEl.value)
  }
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  resizeObserver?.disconnect()
})

watch(() => props.initialCanvasData, (newVal) => {
  parseData(newVal); history.value = [exportData()]; historyIndex.value = 0
}, { immediate: true })

watch(() => props.bars, (newBars) => {
  if (!scalePixelsPerMeter.value) return
  let changed = false
  elements.value.forEach(el => {
    if (el.type !== 'bar') return
    const bar = newBars.find(b => b.id === el.barId)
    if (!bar) return
    const newW = barWidthPx(bar.length_cm || 600)
    if (el.w !== newW) {
      el.x = Math.round(el.x + (el.w || 160) / 2 - newW / 2)
      el.w = newW
      changed = true
    }
  })
  if (changed) emitChange()
}, { deep: true })
</script>

<style scoped>
@reference "../style.css";
.fade-panel-enter-active, .fade-panel-leave-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.fade-panel-enter-from, .fade-panel-leave-to { opacity: 0; transform: scale(0.95); }
</style>
