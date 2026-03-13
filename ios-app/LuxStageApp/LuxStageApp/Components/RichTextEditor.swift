import SwiftUI
import UIKit

/// Editable rich-text editor that reads/writes HTML.
/// Uses the iOS 26 native AttributedString-based TextEditor with a formatting toolbar.
struct RichTextEditor: View {
    @Binding var html: String

    @Environment(\.fontResolutionContext) private var fontResolutionContext
    @Environment(\.colorScheme) private var colorScheme
    @Environment(AppLocale.self) private var locale

    @State private var attributedText: AttributedString = AttributedString("")
    @State private var selection = AttributedTextSelection()

    @State private var selectedForegroundColor = Color.primary
    @State private var showingColorPicker = false
    @State private var isSyncing = false
    @State private var didLoad = false
    @State private var previousText: String = ""

    var body: some View {
        VStack(spacing: 0) {
            // Formatting Toolbar
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 4) {
                    FormatButton(icon: "bold",        isActive: isBold,       action: toggleBold)
                    FormatButton(icon: "italic",      isActive: isItalic,     action: toggleItalic)
                    FormatButton(icon: "underline",   isActive: hasUnderline, action: toggleUnderline)

                    Divider().frame(height: 22)

                    FormatButton(icon: "list.bullet", isActive: false, action: insertBullet)

                    Divider().frame(height: 22)

                    // Text colour picker
                    Button(action: { showingColorPicker.toggle() }) {
                        HStack(spacing: 4) {
                            Image(systemName: "textformat")
                            Circle()
                                .fill(selectedForegroundColor)
                                .frame(width: 13, height: 13)
                                .overlay(Circle().stroke(Color.gray.opacity(0.4), lineWidth: 1))
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 5)
                        .background(showingColorPicker ? Color.accentColor.opacity(0.15) : Color.clear)
                        .cornerRadius(6)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
            }
            .background(.bar)

            if showingColorPicker {
                ColorPicker(locale.t("color.picker.text"), selection: $selectedForegroundColor)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Color(.systemGray5))
                    .onChange(of: selectedForegroundColor) { _, newColor in
                        applyForegroundColor(newColor)
                    }
            }

            Divider()

            // Attributed text editor — scrollContentBackground hidden so our background shows
            TextEditor(text: $attributedText, selection: $selection)
                .scrollContentBackground(.hidden)
                .background(Color(.systemBackground))
                .padding(.horizontal, 8)
                .padding(.vertical, 12)
                .onChange(of: selection) { _, _ in
                    updateToolbarState()
                }
                .onChange(of: attributedText) { _, newValue in
                    guard !isSyncing else { return }
                    continueBulletIfNeeded(newValue: newValue)
                    isSyncing = true
                    html = exportHTML(from: attributedText)
                    isSyncing = false
                    previousText = String(attributedText.characters)
                }
        }
        .onAppear {
            guard !didLoad else { return }
            didLoad = true
            attributedText = importHTML(html)
            previousText = String(attributedText.characters)
        }
        .onChange(of: html) { _, newHTML in
            guard !isSyncing else { return }
            let current = exportHTML(from: attributedText)
            if newHTML != current {
                isSyncing = true
                attributedText = importHTML(newHTML)
                isSyncing = false
            }
        }
    }

    // MARK: - Computed state

    private var isBold: Bool {
        let font = selection.typingAttributes(in: attributedText).font
        return (font ?? .default).resolve(in: fontResolutionContext).isBold
    }

    private var isItalic: Bool {
        let font = selection.typingAttributes(in: attributedText).font
        return (font ?? .default).resolve(in: fontResolutionContext).isItalic
    }

    private var hasUnderline: Bool {
        selection.typingAttributes(in: attributedText).underlineStyle != nil
    }

    // MARK: - Formatting actions

    private func toggleBold() {
        let bold = !isBold
        attributedText.transformAttributes(in: &selection) {
            $0.font = ($0.font ?? .default).bold(bold)
        }
    }

    private func toggleItalic() {
        let italic = !isItalic
        attributedText.transformAttributes(in: &selection) {
            $0.font = ($0.font ?? .default).italic(italic)
        }
    }

    private func toggleUnderline() {
        let add = !hasUnderline
        attributedText.transformAttributes(in: &selection) {
            $0.underlineStyle = add ? .single : nil
        }
    }

    private func applyForegroundColor(_ color: Color) {
        attributedText.transformAttributes(in: &selection) {
            $0.foregroundColor = color
        }
    }

    /// Insert a bullet point "• " at the start of the current line.
    private func insertBullet() {
        let text = String(attributedText.characters)
        let cursorIndex: AttributedString.Index

        switch selection.indices(in: attributedText) {
        case .insertionPoint(let idx):
            cursorIndex = idx
        case .ranges(let rangeSet):
            cursorIndex = rangeSet.ranges.first?.lowerBound ?? attributedText.startIndex
        }

        let charOffset = attributedText.characters.distance(from: attributedText.startIndex, to: cursorIndex)
        let nsString = text as NSString
        let lineStart = nsString.lineRange(for: NSRange(location: charOffset, length: 0)).location

        let insertAt = attributedText.index(attributedText.startIndex, offsetByCharacters: lineStart)
        let bullet = AttributedString("• ")
        attributedText.insert(bullet, at: insertAt)
    }

    private func updateToolbarState() {
        if let color = selection.typingAttributes(in: attributedText).foregroundColor {
            selectedForegroundColor = color
        }
    }

    /// If the user just pressed Enter at the end of a bullet line, prepend "• " on the new line.
    private func continueBulletIfNeeded(newValue: AttributedString) {
        let newText = String(newValue.characters)
        let oldText = previousText

        // Only act when exactly one character was added and it's a newline
        guard newText.count == oldText.count + 1,
              let cursorIdx = newText.indices.first(where: { idx in
                  let offset = newText.distance(from: newText.startIndex, to: idx)
                  return offset < oldText.count
                      ? newText[idx] != oldText[oldText.index(oldText.startIndex, offsetBy: offset)]
                      : true
              }),
              newText[cursorIdx] == "\n" else { return }

        // Find the line just before the newline that was inserted
        let insertOffset = newText.distance(from: newText.startIndex, to: cursorIdx)
        let nsNew = newText as NSString
        // Line range of the character just before the \n
        guard insertOffset > 0 else { return }
        let prevCharOffset = insertOffset - 1
        let prevLineRange = nsNew.lineRange(for: NSRange(location: prevCharOffset, length: 0))
        let prevLine = nsNew.substring(with: prevLineRange)
            .trimmingCharacters(in: .newlines)

        guard prevLine.hasPrefix("• ") else { return }

        // The new line starts right after the inserted \n
        let newLineOffset = insertOffset + 1
        guard newLineOffset <= newText.count else { return }

        isSyncing = true
        let insertAt = attributedText.index(attributedText.startIndex, offsetByCharacters: newLineOffset)
        let bullet = AttributedString("• ")
        attributedText.insert(bullet, at: insertAt)

        // Move cursor to after the "• "
        let afterBullet = attributedText.index(attributedText.startIndex, offsetByCharacters: newLineOffset + 2)
        selection = AttributedTextSelection(insertionPoint: afterBullet)
        isSyncing = false
    }

    // MARK: - HTML import/export

    private func importHTML(_ html: String) -> AttributedString {
        guard !html.isEmpty else { return AttributedString("") }
        let wrapped = """
        <html><head><meta charset="utf-8"></head>
        <body style="font-family:-apple-system;font-size:17px;">\(html)</body></html>
        """
        guard let data = wrapped.data(using: .utf8),
              let nsAttr = try? NSAttributedString(
                data: data,
                options: [.documentType: NSAttributedString.DocumentType.html,
                          .characterEncoding: String.Encoding.utf8.rawValue],
                documentAttributes: nil
              ) else {
            return AttributedString(html)
        }

        let mutable = NSMutableAttributedString(attributedString: nsAttr)
        while mutable.length > 0 && mutable.string.hasSuffix("\n") {
            mutable.deleteCharacters(in: NSRange(location: mutable.length - 1, length: 1))
        }

        var result = AttributedString("")
        mutable.enumerateAttributes(in: NSRange(location: 0, length: mutable.length)) { attrs, range, _ in
            let text = (mutable.string as NSString).substring(with: range)
            var container = AttributeContainer()

            if let uiFont = attrs[.font] as? UIFont {
                let traits = uiFont.fontDescriptor.symbolicTraits
                var swiftFont = Font.system(size: uiFont.pointSize)
                if traits.contains(.traitBold)   { swiftFont = swiftFont.bold() }
                if traits.contains(.traitItalic) { swiftFont = swiftFont.italic() }
                container.font = swiftFont
            }
            if let underline = attrs[.underlineStyle] as? Int, underline != 0 {
                container.underlineStyle = .single
            }
            // Don't import foreground color — lets the editor inherit .primary,
            // which adapts correctly to Dark Mode. Only import non-default colors.
            if let uiColor = attrs[.foregroundColor] as? UIColor {
                var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
                uiColor.getRed(&r, green: &g, blue: &b, alpha: &a)
                // Skip black (0,0,0) and white (1,1,1) — these are default text colors
                let isDefaultColor = (r < 0.05 && g < 0.05 && b < 0.05) ||
                                     (r > 0.95 && g > 0.95 && b > 0.95)
                if !isDefaultColor {
                    container.foregroundColor = Color(uiColor)
                }
            }

            var chunk = AttributedString(text)
            chunk.mergeAttributes(container)
            result.append(chunk)
        }
        return result
    }

    private func exportHTML(from attrStr: AttributedString) -> String {
        guard !attrStr.characters.isEmpty else { return "" }

        var html = ""
        let string = String(attrStr.characters)
        let lines = string.components(separatedBy: "\n")
        var charOffset = attrStr.startIndex
        var inList = false

        for (lineIndex, line) in lines.enumerated() {
            let lineLength = line.count
            let isBullet = line.hasPrefix("• ")

            if isBullet && !inList { html += "<ul>"; inList = true }
            if !isBullet && inList { html += "</ul>"; inList = false }

            if lineLength == 0 {
                html += "<p></p>"
            } else {
                let lineEnd = attrStr.index(charOffset, offsetByCharacters: lineLength)

                if isBullet {
                    let contentStart = attrStr.index(charOffset, offsetByCharacters: 2)
                    html += "<li>" + renderSpans(attrStr[contentStart..<lineEnd]) + "</li>"
                } else {
                    html += "<p>" + renderSpans(attrStr[charOffset..<lineEnd]) + "</p>"
                }
            }

            if lineIndex < lines.count - 1 {
                charOffset = attrStr.index(charOffset, offsetByCharacters: lineLength + 1)
            }
        }

        if inList { html += "</ul>" }

        while html.hasSuffix("<p></p>") {
            html = String(html.dropLast(7))
        }
        return html
    }

    private func renderSpans(_ sub: AttributedSubstring) -> String {
        var result = ""
        for run in sub.runs {
            let text = String(sub[run.range].characters)
                .replacingOccurrences(of: "&", with: "&amp;")
                .replacingOccurrences(of: "<", with: "&lt;")
                .replacingOccurrences(of: ">", with: "&gt;")

            var segment = text
            let attrs = run.attributes

            if attrs.underlineStyle != nil { segment = "<u>\(segment)</u>" }

            if let font = attrs.font {
                let resolved = font.resolve(in: fontResolutionContext)
                if resolved.isItalic { segment = "<em>\(segment)</em>" }
                if resolved.isBold   { segment = "<strong>\(segment)</strong>" }
            }

            result += segment
        }
        return result
    }
}

// MARK: - Toolbar Button

private struct FormatButton: View {
    let icon: String
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .medium))
                .frame(width: 32, height: 32)
                .background(isActive ? Color.accentColor.opacity(0.15) : Color.clear)
                .cornerRadius(6)
        }
    }
}
// MARK: - Preview

#Preview {
    @Previewable @State var html = "<p>Sixbar 1000</p><p>Cuepix 2x</p><ul><li><strong>Standard</strong></li></ul>"

    NavigationStack {
        RichTextEditor(html: $html)
            .navigationTitle("Edit setup notes")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fertig") {}
                }
            }
    }
    .environment(AppLocale.shared)
}

