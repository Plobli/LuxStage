# Channel Spotlight Arrow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kanal-Marker im Floorplan als Kreis+Richtungspfeil darstellen; nach dem Platzieren wird per zweitem Klick die Richtung gesetzt, mit gestrichelter Live-Vorschau.

**Architecture:** Neuer interner Tool-Zustand `channel-direction` nach dem Platzieren eines Kanals. Während dieses Zustands folgt ein gestrichelter Vorschau-Pfeil dem Mauszeiger. Zweiter Klick berechnet den Winkel (atan2) und speichert ihn als `rotation` am Element. Das v-group-Template der Channel-Marker wird um einen `v-arrow`-Node (Konva Arrow) erweitert.

**Tech Stack:** Vue 3, vue-konva (Konva.js), kein neues Paket nötig — `v-arrow` ist Teil von vue-konva.

---

### Task 1: Kanal-Marker um Richtungspfeil erweitern

**Files:**
- Modify: `src/components/FloorplanEditor.vue` — v-group Channel-Template

- [ ] **Schritt 1: v-arrow zum Channel-Marker hinzufügen**

Im `v-group`-Block der Channel-Marker (nach `v-text`) einen `v-arrow` einfügen:

```vue
<v-arrow :config="{
  points: [0, 0, 30, 0],
  pointerLength: 7,
  pointerWidth: 6,
  fill: '#60a5fa',
  stroke: '#60a5fa',
  strokeWidth: 2,
  rotation: el.rotation || 0,
  listening: false,
}" />
```

- [ ] **Schritt 2: Rotation der Gruppe entfernen, Pfeil trägt die Rotation**

Die Gruppe selbst hat keine Rotation. Nur der `v-arrow` dreht sich via `rotation: el.rotation || 0`. Der Kreis und der Text bleiben unrotiert.

- [ ] **Schritt 3: Visuell prüfen**

Dev-Server starten (`npm run dev`), einen Kanal platzieren, im Rotations-Slider die Richtung ändern → Pfeil dreht sich, Kreis bleibt stabil.

- [ ] **Schritt 4: Commit**

```bash
git add src/components/FloorplanEditor.vue
git commit -m "feat(floorplan): Richtungspfeil am Kanal-Marker"
```

---

### Task 2: Neuer Tool-Zustand `channel-direction`

**Files:**
- Modify: `src/components/FloorplanEditor.vue` — State, placeChannelCircle, onStageMouseUp, onStageMouseMove

- [ ] **Schritt 1: State für pending Channel-ID anlegen**

```js
const pendingDirectionId = ref(null) // ID des zuletzt platzierten Kanals
const directionPreview = ref(null)   // { x1, y1, x2, y2 } für gestrichelten Vorschau-Pfeil
```

- [ ] **Schritt 2: placeChannelCircle anpassen**

Nach dem Platzieren nicht zu `select` wechseln, sondern zu `channel-direction`:

```js
function placeChannelCircle(ch) {
  const id = uuid()
  addElement({
    id,
    type: 'channel',
    x: channelPickerPos.value.x,
    y: channelPickerPos.value.y,
    channel: ch.channel,
    rotation: 0,
  })
  showChannelPicker.value = false
  pendingDirectionId.value = id
  activeTool.value = 'channel-direction'
  emitChange()
}
```

- [ ] **Schritt 3: Cursor-Style für channel-direction ergänzen**

In der Container-`:class`-Bindung:

```vue
:class="activeTool === 'pan' ? 'cursor-grab' : activeTool !== 'select' ? 'cursor-crosshair' : 'cursor-default'"
```

Bleibt unverändert — `cursor-crosshair` gilt bereits für alle Nicht-Select/Pan-Tools.

- [ ] **Schritt 4: onStageMouseMove für Vorschau-Pfeil**

Im `onStageMouseMove`-Handler ganz oben ergänzen (vor dem `isPanning`-Check):

```js
if (activeTool.value === 'channel-direction' && pendingDirectionId.value) {
  const el = elements.value.find(e => e.id === pendingDirectionId.value)
  if (el) {
    const pos = getPointerPos()
    directionPreview.value = { x: el.x, y: el.y, tx: pos.x, ty: pos.y }
  }
  return
}
```

- [ ] **Schritt 5: onStageMouseUp für zweiten Klick**

Am Anfang von `onStageMouseUp`, vor dem `isPanning`-Check:

```js
if (activeTool.value === 'channel-direction' && pendingDirectionId.value) {
  const el = elements.value.find(e => e.id === pendingDirectionId.value)
  if (el) {
    const pos = getPointerPos()
    const dx = pos.x - el.x
    const dy = pos.y - el.y
    el.rotation = Math.atan2(dy, dx) * 180 / Math.PI
    emitChange()
  }
  pendingDirectionId.value = null
  directionPreview.value = null
  activeTool.value = 'select'
  return
}
```

- [ ] **Schritt 6: Escape-Key channel-direction abbrechen**

Im `handleKeyDown`-Handler bei `Escape`:

```js
if (e.key === 'Escape') {
  if (activeTool.value === 'channel-direction') {
    pendingDirectionId.value = null
    directionPreview.value = null
  }
  activeTool.value = 'select'
  selectedIds.value = new Set()
  return
}
```

- [ ] **Schritt 7: Commit**

```bash
git add src/components/FloorplanEditor.vue
git commit -m "feat(floorplan): channel-direction Zustand nach Platzierung"
```

---

### Task 3: Gestrichelter Vorschau-Pfeil im Canvas

**Files:**
- Modify: `src/components/FloorplanEditor.vue` — Template, Preview-Shape

- [ ] **Schritt 1: directionPreview-Arrow im v-layer einfügen**

Nach den bestehenden Preview-Shapes (nach dem Lasso-rect, vor `</v-layer>`):

```vue
<!-- Richtungs-Vorschau beim channel-direction Tool -->
<v-arrow
  v-if="directionPreview"
  :config="{
    points: [
      directionPreview.x, directionPreview.y,
      directionPreview.x + Math.cos(Math.atan2(directionPreview.ty - directionPreview.y, directionPreview.tx - directionPreview.x)) * 30,
      directionPreview.y + Math.sin(Math.atan2(directionPreview.ty - directionPreview.y, directionPreview.tx - directionPreview.x)) * 30,
    ],
    pointerLength: 7,
    pointerWidth: 6,
    fill: '#3b82f6',
    stroke: '#3b82f6',
    strokeWidth: 2,
    dash: [5, 4],
    listening: false,
  }"
/>
```

> Hinweis: Die Pfeil-Länge ist fix 30px (Canvas-Koordinaten, entspricht dem Marker-Pfeil). Die Richtung zeigt immer vom Marker-Mittelpunkt zum Mauszeiger.

- [ ] **Schritt 2: Visuell prüfen**

Kanal platzieren → Picker → Kanal wählen → gestrichelter Vorschau-Pfeil folgt der Maus → Klick setzt Richtung → zurück zu Select.

- [ ] **Schritt 3: Commit**

```bash
git add src/components/FloorplanEditor.vue
git commit -m "feat(floorplan): gestrichelte Vorschau beim Richtung setzen"
```

---

### Task 4: Rotations-Slider in Sidebar für Kanäle freischalten

**Files:**
- Modify: `src/components/FloorplanEditor.vue` — Sidebar Template

- [ ] **Schritt 1: Rotation-Block für channel-Typ einblenden**

Aktuell ist der Rotations-Slider mit `v-if="selectedElement.type !== 'channel'"` versteckt. Ändern zu:

```vue
<template v-if="selectedElement.type !== 'channel' || true">
```

Nein — sauberer: Die Bedingung einfach entfernen, sodass der Slider für alle Typen gilt:

```vue
<template>  <!-- war: v-if="selectedElement.type !== 'channel'" -->
```

Also `v-if="selectedElement.type !== 'channel'"` aus dem `<template>`-Tag entfernen.

- [ ] **Schritt 2: Prüfen dass updateRotation für channel funktioniert**

`updateRotation` setzt `el.rotation` direkt — das funktioniert bereits für alle Typen.

- [ ] **Schritt 3: Commit**

```bash
git add src/components/FloorplanEditor.vue
git commit -m "feat(floorplan): Rotations-Slider auch für Kanal-Marker"
```

---

### Task 5: Version bump

**Files:**
- Modify: `package.json`

- [ ] **Version in package.json erhöhen** (2.3.3 → 2.3.4)

- [ ] **Commit**

```bash
git add package.json
git commit -m "chore: bump version to 2.3.4"
```
