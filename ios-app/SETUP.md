# LuxStage iOS – Xcode Setup

## Xcode-Projekt erstellen

1. Xcode öffnen → **Create New Project**
2. **iOS → App** → Next
3. Einstellungen:
   - Product Name: `LuxStage`
   - Team: (dein Apple-Account)
   - Organization Identifier: z.B. `de.christopherbast`
   - Bundle Identifier: `de.christopherbast.luxstage`
   - Interface: **SwiftUI**
   - Language: **Swift**
   - **Minimum Deployments: iOS 17.0**
4. Speicherort: `LuxStage/ios-app/` (diesen Ordner wählen)

## Vorhandene Swift-Dateien hinzufügen

Nach dem Erstellen des Projekts:

1. In Xcode den generierten `ContentView.swift` und `<AppName>App.swift` **löschen**
2. Alle Dateien aus `ios-app/LuxStage/` per Drag & Drop in das Xcode-Projekt ziehen:
   - `LuxStageApp.swift`
   - `Models/Models.swift`
   - `API/PocketBaseClient.swift`
   - `Views/LoginView.swift`
   - `Views/ShowsListView.swift`
   - `Views/ShowDetailView.swift`
   - `Views/ChannelEditSheet.swift`
   - `Views/SettingsView.swift`
   - `Components/ColorPickerField.swift`
3. Beim Hinzufügen: **"Copy items if needed"** deaktivieren (Dateien liegen schon am richtigen Ort)

## filters.json ins Bundle kopieren

1. `shared/filters.json` in den Xcode-Projektordner kopieren:
   ```
   cp shared/filters.json ios-app/LuxStage/filters.json
   ```
2. In Xcode: Rechtsklick auf den LuxStage-Ordner → **Add Files to "LuxStage"**
3. `filters.json` auswählen → **Target Membership: LuxStage** aktivieren

## Build & Run

- Simulator oder echtes iPad/iPhone auswählen
- ⌘R drücken
- Server-URL in den Einstellungen eintragen (z.B. `http://192.168.1.100:8090`)
