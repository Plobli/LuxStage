# Migrationsplan: LuxStage UI zu Shadcn Vue (Tailwind v4)

## Zielsetzung
Die gesamte Web-App wird schrittweise auf **Shadcn Vue**, **Radix Vue** (für Accessibility/Logik) und **VueUse** (für Virtual Scrolling) migriert. Das bestehende, dunkle FOH-Farbschema (Rot `#D95C5C` als Akzent, Dunkelblau `#030712` als Hintergrund) bleibt als Basis-Theme erhalten.

---

## Phase 1: Fundament & Infrastruktur (Abgeschlossen / In Arbeit)
1. **Voraussetzungen prüfen**
   - [x] Tailwind v4 ist installiert (`@tailwindcss/vite`)
   - [x] Vite-Aliase (`@/*`) sind konfiguriert
   - [x] `jsconfig.json` für IDE-Support angelegt

2. **Shadcn Initialisierung**
   - [x] `npx shadcn-vue@latest init` ausführen (Theme: *Zinc* oder *Neutral* wählen, da es als gute Basis für FOH-Apps dient)
   - [x] Automatisch generierte Tailwind-Farben in `style.css` durch das bestehende LuxStage-Farbschema ersetzen
   - [x] Icons installieren (`npm install lucide-vue-next`)

---

## Phase 2: Aufbau der UI-Bibliothek (`src/components/ui`)
Statt Standard-HTML-Elementen werden native Shadcn-Komponenten installiert. Das passiert via CLI: `npx shadcn-vue@latest add <component>`.

1. **Basis-Elemente**
   - [x] `button`, `input`, `textarea`, `checkbox`, `label`
2. **Struktur-Elemente**
   - [x] `card` (Für Dashboard-Widgets, Show-Übersicht)
   - [x] `separator` (Für saubere Trennlinien)
3. **Komplexe Elemente (Radix-basiert)**
   - [x] `dialog` (Für Modal-Fenster wie "Neue Show anlegen")
   - [x] `dropdown-menu` (Für Benutzer-Menü, Kontext-Aktionen bei Shows)
   - [x] `tabs` (Für den Wechsel zwischen Übersicht, Kanalliste, Plan, Dokumentation)
   - [x] `toast` / `sonner` (Für Erfolgsmeldungen: "Gespeichert")

---

## Phase 3: Migration der Ansichten (`src/views`)
Die alten `.vue`-Dateien werden Schritt für Schritt mit den neuen Shadcn-Komponenten refactored. Dabei wird auf Headless UI verzichtet (da Radix diese Aufgabe übernimmt).

1. **Login (`LoginView.vue`)**
   - [x] Umbau auf Shadcn `Card`, `Input` und `Button`.
   - [x] Vollständige Tastaturnavigation sicherstellen.

2. **Dashboard / Show-Liste (`ShowsView.vue`)**
   - [x] Grid-Layout mit Shadcn `Card` für jede Show.
   - [x] Shadcn `Dialog` für den "Neue Show" / "Template auswählen" Workflow.

3. **Show-Details / Die Channel-Liste (`ShowDetailView.vue` / `TemplatesView.vue`)**
   - [ ] **Virtual Scrolling (VueUse):** Implementierung von `useVirtualList` für die Kanal-Tabelle, um selbst bei 1000+ DMX-Kanälen lagfreies Scrollen zu garantieren.
   - [ ] **Tabs:** Umsetzung der Navigation (Kanäle / Patch / Info) mit Shadcn `Tabs`.

4. **Floorplan Editor (Konva)**
   - [ ] Layout-Trennung: Linke/Rechte Sidebar (`Card`-Style) für Werkzeuge, mittig die freie Konva-Fläche.

---

## Phase 4: Aufräumen
- [ ] Entfernung alter UI-Frameworks (z.B. `@headlessui/vue`, `@heroicons/vue`), da Radix und Lucide diese ersetzen.
- [ ] Bereinigung von lokalem Custom-CSS in Komponenten, da alles über Tailwind-Utility-Klassen gelöst wird.
