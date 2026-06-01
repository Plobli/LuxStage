---
name: LuxStage
colors:
  background: "hsl(0, 0%, 100%)"
  background-dark: "hsl(240, 10%, 5%)"
  surface-deep: "hsl(0, 0%, 97%)"
  surface-deep-dark: "hsl(240, 10%, 3%)"
  surface-raised: "hsl(0, 0%, 96%)"
  surface-raised-dark: "hsl(240, 10%, 6%)"
  surface-high: "hsl(0, 0%, 94%)"
  surface-high-dark: "hsl(240, 10%, 10%)"
  foreground: "hsl(240, 10%, 3.9%)"
  foreground-dark: "hsl(0, 0%, 95%)"
  primary: "hsl(240, 5.9%, 10%)"
  primary-dark: "hsl(0, 0%, 95%)"
  primary-foreground: "hsl(0, 0%, 98%)"
  secondary: "hsl(240, 4.8%, 95.9%)"
  secondary-dark: "hsl(240, 5%, 18%)"
  muted: "hsl(240, 4.8%, 95.9%)"
  muted-foreground: "hsl(240, 3.8%, 46.1%)"
  accent: "hsl(44, 90%, 80%)"
  accent-foreground: "hsl(240, 10%, 5%)"
  destructive: "hsl(358, 86%, 59%)"
  border: "hsl(240, 5.9%, 90%)"
  border-dark: "hsl(240, 5%, 22%)"
  card: "hsl(0, 0%, 100%)"
  card-dark: "hsl(240, 8%, 8%)"
  ring: "hsl(240, 10%, 3.9%)"
---

# Design System: LuxStage

## 1. Visual Theme & Atmosphere

LuxStage ist eine professionelle Produktionsverwaltungs-App für Theater und Bühnen. Das Design ist kompromisslos funktional: klares Weiß-auf-Weiß im Light Mode, tiefes kühles Blau-Schwarz im Dark Mode. Beide Modi strahlen Ernsthaftigkeit aus — kein Spielerei, keine Dekoration. Die einzige Farbe ist ein warmes Goldgelb (Amber) als Akzent, das wie ein Spotlight-Licht auf der Bühne wirkt.

Die Informationsdichte ist moderat — Listen mit viel Atmen, Tabellen mit klaren Trennlinien, großzügige Seitenränder. Die Sidebar ist schmal und icon-only auf Desktop, die Navigation reduziert auf das Minimum. Alles ist auf Effizienz ausgelegt: schnelles Erfassen, schnelles Handeln, kein visueller Lärm.

## 2. Color Palette & Roles

### Primary Foundation
- **Reines Weiß** `hsl(0, 0%, 100%)` — Body background, Cards, Popovers (Light)
- **Tiefes Kühles Dunkel** `hsl(240, 10%, 5%)` — Body background (Dark)
- **Sehr Helles Grau** `hsl(0, 0%, 97%)` — surface-deep, tiefstes Surface-Layer
- **Leichtes Grau** `hsl(0, 0%, 96%)` — surface-raised, z.B. ShowHeader-Hintergrund
- **Mittleres Grau** `hsl(0, 0%, 94%)` — surface-high, Desktop-Sidebar-Hintergrund
- **Dark Card** `hsl(240, 8%, 8%)` — Cards im Dark Mode

### Accent & Interactive
- **Warmes Goldgelb** `hsl(44, 90%, 80%)` — Accent, aktive Nav-Items, FAB, primäre CTAs (`bg-accent`)
- **Fast Schwarz** `hsl(240, 5.9%, 10%)` — Primary-Button-Hintergrund (Light)
- **Fast Weiß** `hsl(0, 0%, 95%)` — Primary-Button-Hintergrund (Dark)
- **Klares Rot** `hsl(358, 86%, 59%)` — Destructive-Zustand, Fehler-Alerts

### Typography & Text Hierarchy
- **Tiefes Dunkel** `hsl(240, 10%, 3.9%)` — Primäre Fließtext-Farbe (foreground)
- **Mittleres Grau** `hsl(240, 3.8%, 46.1%)` — Sekundärtext, Metadaten (muted-foreground)
- **Transparentes Grau** `muted-foreground/60` und `/50` — Tertiär, Labels, Spalten-Header

### Functional States
- **Zerstörendes Rot** `hsl(358, 86%, 59%)` — Löschen, Archivieren, Fehler
- **Grenze** `hsl(240, 5.9%, 90%)` — Trennlinien zwischen Inhalten (Light)
- **Dunkle Grenze** `hsl(240, 5%, 22%)` — Trennlinien (Dark)

## 3. Typography Rules

### Hierarchy & Weights
- **Systemschrift (sans-serif)** — Keine Custom-Font; verwendet Browser-Standard / Tailwind default (`font-sans`)
- **H1 / Page Title**: `text-2xl` (1.5rem), `font-semibold` (600) — Seitentitel, Show-Namen
- **H2 / Section Label**: `text-xs`, `font-semibold`, `uppercase`, `tracking-wider` / `tracking-widest`, `text-muted-foreground/50` — Gruppen-Trennzeilen in Listen
- **Body / Table**: `text-sm` (0.875rem), `font-medium` für Primärwerte, normal für Sekundärwerte
- **Micro / Meta**: `text-xs` (0.75rem), `text-muted-foreground` — Datum, Version, Captions
- **Navigation Labels**: `text-[10px]` (0.625rem), unter Icon-Nav auf Desktop

### Spacing Principles
- Kein nennenswertes `letter-spacing` für Body-Text; Gruppenheader nutzen `tracking-wider` / `tracking-widest` für optische Trennung
- `line-height` über Tailwind-Defaults (`text-sm/6` = 1.5rem line-height für Body)
- Inline-Editierfelder teilen exakt die Schriftgröße des angezeigten Textes (nahtloser Übergang)

## 4. Component Stylings

### Buttons
- **Form**: Vollständig runde Pill-Form (`rounded-full`) — modern, nicht steif
- **Standard-Größe**: 40px hoch (`h-10`), `px-4 py-2`
- **Icon-Only**: 40×40px (`h-10 w-10`) — Touch-Target-konform
- **Varianten**:
  - `default` — Near-schwarz Hintergrund, weißer Text; hover: 70% Opacity + leichter Schatten
  - `accent` — Goldgelber Hintergrund, dunkler Text; hover: 65% Opacity + Schatten — primäre CTAs und FAB
  - `outline` — Border + transparenter BG; hover: muted BG
  - `ghost` — Kein BG; hover: `bg-accent/70` — Icon-Buttons in Headern
  - `destructive` — Rotes BG; hover: 70% Opacity
  - `secondary` — Helles Grau; dezenter
  - `link` — Nur Text mit Unterstreichung auf hover
- **Transition**: `transition-all` auf allen Varianten

### Cards & Containers
- `rounded-lg` (0.5rem) — moderater Radius
- `border border-border` — dezente Grenzlinie
- `bg-card` — weiß / dunkel-grau je Modus
- `shadow-sm` — minimalster Schatten
- Kein Hover-Shadow-Effekt auf Cards selbst; Zeilen in Listen: `hover:bg-muted/50`
- Show-Listen: `rounded-xl overflow-hidden` als Container, Zeilen ohne eigenen Radius

### Navigation
- **Desktop**: Schmale vertikale Sidebar (80px / `w-20`), icon-only mit Mini-Labels (`text-[10px]`)
  - Aktiv-Zustand: `bg-accent/85 text-accent-foreground` auf dem Icon-Container (`rounded-lg`)
  - Hover: `bg-white/5` — sehr subtil
  - Hintergrund: `bg-surface-high` (hell: 94% Weiß, dunkel: 10% Aufhellung)
- **Mobile**: Top-Bar mit Hamburger, volle Sidebar als Overlay mit `backdrop-blur-sm`
  - Aktiv-Zustand: `bg-accent text-accent-foreground rounded-md`
- Abzeichen (Notification Dot): `size-2 rounded-full bg-accent` — minimalistisch

### Inputs & Forms
- **Standard**: `h-10 rounded-xl px-3 py-2 text-sm` — etwas runder als Cards
- **Groß (lg)**: `h-12 rounded-xl px-4 text-base bg-card` — für Formulare in Dialogen
- Border: `border-input`; focus: `focus-visible:border-ring focus-visible:ring-1` — kein Outline, nur Ring
- Placeholder: `text-muted-foreground`
- Labels: `text-sm font-medium` aus dem Label-Komponent

### Domain-Specific: Show-Liste
- Zeilenlayout via CSS Grid: responsiv mit 2/4/5 Spalten (`grid-cols-[1fr_2rem]` → `lg:grid-cols-[1fr_10rem_10rem_0.5fr_2rem]`)
- Zeilen-Hover: `hover:bg-muted/50` — subtile Hervorhebung
- Gruppen-Trennlinie: `flex-1 h-px bg-border/50` — sehr dezent
- Aktions-Button erscheint nur on hover: `opacity-0 group-hover:opacity-100 transition-opacity`

### Domain-Specific: Tabs
- TabsList: `rounded-md bg-muted p-1` — Pill-Container
- TabsTrigger: runde Aktivmarkierung innerhalb des Muted-Containers

## 5. Layout Principles

### Grid & Structure
- Kein fixer Max-Width-Container auf Seitenebene; Padding via `px-4 py-8 sm:px-6 lg:px-8`
- Desktop-Sidebar: `w-20` (80px) fest; Hauptinhalt: `md:pl-20`
- Mobile: Full-Width mit Overflow-Scroll auf `<main class="h-dvh overflow-y-auto">`
- Dialog max-width: `sm:max-w-lg` (32rem) / `sm:max-w-md` (28rem)

### Whitespace Strategy
- Basis-Spacing-Einheit: Tailwind 4 (0.25rem → 4px)
- Seitenpadding: 16px → 24px → 32px (xs→sm→lg)
- Vertikaler Abstand zwischen Sections: `mb-8` (2rem)
- Zeilen-Padding: `px-4 py-3` — kompakt, aber nicht gedrängt
- Safe-Area-Inset oben: `pt-[env(safe-area-inset-top)]` — iOS-kompatibel

### Alignment & Visual Balance
- Primäre Textausrichtung: linksbündig
- Dialoge und Login-Card: zentriert mit `sm:mx-auto`
- Icon + Label: `gap-1` bis `gap-3` konsistent
- Chevrons und Badges rechts ausgerichtet mit `justify-end`

### Responsive Behavior & Touch
- **Mobile-First**: Klassen ohne Prefix = Mobile, dann `sm:`, `md:`, `lg:`
- Touch-Targets: Buttons min. 44px (`h-11`, `min-h-11` für interaktive Inline-Elemente)
- Mobile zeigt weniger Spalten (Grid reduziert von 5 auf 2 Spalten)
- Desktop-Sidebar ist `md:fixed` und nimmt keinen Flow-Platz — Content bekommt `md:pl-20`
- FAB (Floating Action Button): `fixed bottom-6 right-6` auf Mobile und Desktop

## 6. Design System Notes for Stitch Generation

### Language to Use
- "Klares, funktionales Interface für Theaterprofis"
- "Goldgelber Spotlight-Akzent auf dunklem oder hellem Neutral-Hintergrund"
- "Pill-Buttons, runde Inputs, subtile Borders, kein dekorativer Ballast"
- "Kompakte Listen mit Hover-Reveal-Aktionen"
- "Schmale Icon-Sidebar, mobile Hamburger-Overlay"

### Color References
- Background (Light): `hsl(0, 0%, 100%)` — Reines Weiß
- Background (Dark): `hsl(240, 10%, 5%)` — Tiefes Blau-Schwarz
- Accent / Spotlight: `hsl(44, 90%, 80%)` — Warmes Goldgelb `#F5D78E`
- Primary CTA (Light): `hsl(240, 5.9%, 10%)` — Fast Schwarz `#161619`
- Muted Text: `hsl(240, 3.8%, 46.1%)` — Mittleres Blaugrau `#717179`
- Destructive: `hsl(358, 86%, 59%)` — Klares Rot `#E84040`
- Border: `hsl(240, 5.9%, 90%)` — Sehr Helles Grau `#E3E3E8`

### Component Prompts
- "Erstelle eine Show-Liste mit Gruppen-Überschriften als dünne horizontale Linie, Zeilen-Hover in gedämpftem Grau, Aktions-Buttons die beim Hover erscheinen, responsiv von 2 auf 5 Spalten."
- "Erstelle eine schmale vertikale Navigation (80px) mit Icon + Mini-Label, aktiver Zustand als goldgelber `rounded-lg` Hintergrund hinter dem Icon."
- "Erstelle einen Login-Screen mit zentrierter Card (`rounded-lg`, `shadow-sm`), Inputs mit `rounded-xl` und `h-12`, primärem Submit-Button in Pill-Form."

### Incremental Iteration
- Füge `dark`-Klasse an `.dark`-Container hinzu — alle CSS-Variablen schalten automatisch um
- Für neue Seiten: Wrapper `px-4 py-8 sm:px-6 lg:px-8` verwenden
- Neue CTAs: `variant="accent"` für primäre Aktionen, `variant="ghost"` für Icon-only-Aktionen in Headern
- Show-spezifische Daten-Zeilen: CSS Grid mit `group`-Klasse + `group-hover:opacity-100` für versteckte Aktionen
