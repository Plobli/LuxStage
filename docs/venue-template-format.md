# LuxStage — Venue Template Format

**Format Version: 1.0**

This document describes the CSV format for venue templates. A venue template captures the fixed installation of a theatre — the channel patch (which fixture is patched to which DMX address) — so that new shows can be pre-filled automatically.

---

## Quick Start

1. Download [`example-template.csv`](./example-template.csv) and open it in Excel or LibreOffice.
2. Replace the example data with your venue's channel patch.
3. Upload the file in the LuxStage app under **Templates → Upload CSV**.

---

## File Requirements

| Property | Value |
|---|---|
| Format | CSV |
| Delimiter | Semicolon (`;`) |
| Encoding | UTF-8 with BOM (saves automatically from Excel on Windows/Mac) |
| Line endings | Windows (CRLF) or Unix (LF) — both accepted |
| File extension | `.csv` |

> **Tip:** In Excel, always save as "CSV UTF-8 (comma delimited)" — despite the name, Excel uses your regional list separator. In German Excel the separator is `;`.

---

## File Structure

The file has two sections, separated by a line containing only `---`.

```
[Section 1: Venue metadata + show fields]
---
[Section 2: Channel patch table]
```

### Comments

Lines starting with `#` are comments and are ignored by the importer.

---

## Section 1: Venue Metadata

```csv
venue_name;Stadttheater Beispiel
venue_hall;Großes Haus
```

| Key | Required | Description |
|---|---|---|
| `venue_name` | yes | Full name of the theatre |
| `venue_hall` | no | Name of the hall / stage |

### Custom Show Fields

Define fields that need to be filled in for each show (e.g. positions of movable architecture). You can define as many as you need.

```csv
show_field;Portalbrücke;Einheit: m
show_field;SB-Tor;Einheit: m
show_field;Bemerkungen;Freitext
```

**Syntax:** `show_field;<field name>;<optional hint>`

- **Field name**: Freely chosen. Shown as a label in the app. Use your theatre's terminology — any language is fine.
- **Optional hint**: Shown as a placeholder or unit hint next to the input field (e.g. `Einheit: m`, `Unit: ft`, `Freitext`).

The field name is stored as-is and is not translated. Values are filled in per show.

---

## Section 2: Channel Patch

After the `---` separator, a standard CSV table follows.

### Header Row

The first non-comment, non-empty line after `---` is the header row. **Column order does not matter** — the importer matches columns by name.

### Required Columns

| Column | Description |
|---|---|
| `channel_number` | The channel number. Must be a positive integer. Must be unique within the file. |
| `address` | DMX address in `Universe/Address` format (see below). |

### Optional Columns

| Column | Description |
|---|---|
| `device` | Fixture type (e.g. `ETC Source4 19°`, `Robe MegaPointe`) |
| `color` | Filter number or free text (e.g. `R02`, `L201`, `warm white`, or empty) |
| `description` | Purpose / position of the fixture |
| `category` | Grouping (e.g. `Frontlicht`, `Seitenlicht`, `Moving Light`) |

Unknown columns are silently ignored, which allows adding custom columns for reference without breaking the import.

### DMX Address Format

Addresses are written as `Universe/Channel`:

```
1/001   →  Universe 1, DMX channel 1
1/512   →  Universe 1, DMX channel 512
2/043   →  Universe 2, DMX channel 43
```

- Universe: positive integer (1, 2, 3, …)
- Channel: 1–512, zero-padded or not (`001` and `1` are both accepted)
- Leave `address` empty for reserve channels

### Example

```csv
channel_number;address;device;color;description;category
1;1/001;ETC Source4 19°;R02;Frontlicht links;Frontlicht
2;1/002;ETC Source4 19°;R02;Frontlicht rechts;Frontlicht
3;2/001;Robe MegaPointe;;Moving 1;Moving Light
4;2/002;;;;Reserve
```

---

## Validation Rules

The importer checks the following and reports errors before saving:

| Rule | Error shown |
|---|---|
| `channel_number` is missing | Required column missing |
| `channel_number` is not a number | Invalid channel number on line N |
| `channel_number` appears more than once | Duplicate channel number: N |
| `address` does not match `X/Y` format (if not empty) | Invalid address format on line N |

Warnings (non-blocking):
- Rows with empty `channel_number` are skipped
- Unknown columns are ignored

---

## Versioning

Each uploaded CSV creates a new template version. Existing shows are **not** changed — they keep their original channel data. New shows created after the upload will use the new version.

This means you can update your template at any time (e.g. when fixtures change) without affecting archived shows.

---

## Deutsch / German

### Spaltennamen (Englisch, intern)

Alle Spaltenbezeichner im CSV sind englisch, da sie intern verarbeitet werden. Die App zeigt die deutschen Bezeichnungen in der Oberfläche.

| CSV-Spalte | Anzeige (Deutsch) |
|---|---|
| `channel_number` | Kanal |
| `address` | Adresse (Format: Universum/Adresse) |
| `device` | Gerät |
| `color` | Farbe |
| `description` | Beschreibung |
| `category` | Kategorie |

### Tipps für Excel

- Datei speichern als: **CSV UTF-8 (mit Trennzeichen)** → Excel nutzt dann automatisch `;` als Trennzeichen
- Auf Windows und Mac speichert Excel mit BOM, was von der App korrekt erkannt wird
- Alternativ: LibreOffice Calc → Exportieren → CSV → Trennzeichen: Semikolon, Zeichensatz: UTF-8
