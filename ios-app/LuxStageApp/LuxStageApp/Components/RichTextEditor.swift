import SwiftUI
import UIKit

// MARK: - Public SwiftUI View

/// Editable rich-text editor that reads/writes HTML.
/// Shows a formatting toolbar (Bold, Italic, Underline, List) above the keyboard.
struct RichTextEditor: View {
    @Binding var html: String

    var body: some View {
        RichTextViewRepresentable(html: $html)
    }
}

// MARK: - UIViewRepresentable

private struct RichTextViewRepresentable: UIViewRepresentable {
    @Binding var html: String

    func makeCoordinator() -> Delegate {
        Delegate(parent: self)
    }

    func makeUIView(context: Context) -> UITextView {
        let tv = UITextView()
        tv.delegate = context.coordinator
        tv.font = .preferredFont(forTextStyle: .body)
        tv.textColor = .label
        tv.backgroundColor = .clear
        tv.isScrollEnabled = true
        tv.isEditable = true
        tv.textContainerInset = UIEdgeInsets(top: 8, left: 4, bottom: 8, right: 4)
        tv.setContentHuggingPriority(.defaultLow, for: .vertical)

        context.coordinator.loadHTML(html, into: tv)
        return tv
    }

    func updateUIView(_ tv: UITextView, context: Context) {
        if !context.coordinator.isEditing && html != context.coordinator.lastExportedHTML {
            context.coordinator.loadHTML(html, into: tv)
        }
    }

    // MARK: - Delegate

    final class Delegate: NSObject, UITextViewDelegate {
        let parent: RichTextViewRepresentable
        var isEditing = false
        var lastExportedHTML: String = ""

        init(parent: RichTextViewRepresentable) {
            self.parent = parent
        }

        // MARK: - HTML Load

        func loadHTML(_ html: String, into tv: UITextView) {
            guard !html.isEmpty else {
                tv.attributedText = NSAttributedString()
                lastExportedHTML = ""
                return
            }
            let wrapped = """
            <html><head><meta charset="utf-8"></head>
            <body style="font-family:-apple-system;font-size:17px;">\(html)</body></html>
            """
            guard let data = wrapped.data(using: .utf8),
                  let attr = try? NSAttributedString(
                    data: data,
                    options: [.documentType: NSAttributedString.DocumentType.html,
                              .characterEncoding: String.Encoding.utf8.rawValue],
                    documentAttributes: nil
                  ) else {
                tv.text = html
                return
            }

            let mutable = NSMutableAttributedString(attributedString: attr)
            let bodyFont = UIFont.preferredFont(forTextStyle: .body)
            mutable.enumerateAttribute(.font, in: NSRange(location: 0, length: mutable.length)) { value, range, _ in
                guard let font = value as? UIFont else { return }
                let traits = font.fontDescriptor.symbolicTraits
                var descriptor = bodyFont.fontDescriptor
                if let withTraits = descriptor.withSymbolicTraits(traits) {
                    descriptor = withTraits
                }
                mutable.addAttribute(.font, value: UIFont(descriptor: descriptor, size: bodyFont.pointSize), range: range)
            }
            mutable.addAttribute(.foregroundColor, value: UIColor.label, range: NSRange(location: 0, length: mutable.length))

            while mutable.length > 0 && mutable.string.hasSuffix("\n") {
                mutable.deleteCharacters(in: NSRange(location: mutable.length - 1, length: 1))
            }

            tv.attributedText = mutable
            lastExportedHTML = html
        }

        // MARK: - UITextViewDelegate

        func textViewDidChange(_ textView: UITextView) {
            isEditing = true
            let exported = exportHTML(from: textView.attributedText)
            lastExportedHTML = exported
            parent.html = exported
            isEditing = false
        }

        func textViewDidBeginEditing(_ textView: UITextView) {
            isEditing = true
        }

        func textViewDidEndEditing(_ textView: UITextView) {
            isEditing = false
        }

        // MARK: - HTML Export

        private func exportHTML(from attrText: NSAttributedString) -> String {
            guard attrText.length > 0 else { return "" }

            var html = ""
            let string = attrText.string
            let lines = string.components(separatedBy: "\n")
            var charIndex = 0
            var inList = false

            for line in lines {
                let lineLength = line.count
                let isBullet = line.hasPrefix("• ")

                if isBullet && !inList {
                    html += "<ul>"
                    inList = true
                }
                if !isBullet && inList {
                    html += "</ul>"
                    inList = false
                }

                if isBullet {
                    let contentStart = charIndex + 2
                    let contentLength = max(0, lineLength - 2)
                    html += "<li>"
                    if contentLength > 0 {
                        html += renderFormattedSpan(attrText, range: NSRange(location: contentStart, length: contentLength))
                    }
                    html += "</li>"
                } else {
                    let rendered = lineLength > 0
                        ? renderFormattedSpan(attrText, range: NSRange(location: charIndex, length: lineLength))
                        : ""
                    html += "<p>\(rendered)</p>"
                }

                charIndex += lineLength + 1
            }

            if inList { html += "</ul>" }

            while html.hasSuffix("<p></p>") {
                html = String(html.dropLast(7))
            }

            return html
        }

        private func renderFormattedSpan(_ attrText: NSAttributedString, range: NSRange) -> String {
            guard range.length > 0, range.location + range.length <= attrText.length else { return "" }
            var result = ""
            attrText.enumerateAttributes(in: range) { attrs, subRange, _ in
                let text = (attrText.string as NSString).substring(with: subRange)
                    .replacingOccurrences(of: "&", with: "&amp;")
                    .replacingOccurrences(of: "<", with: "&lt;")
                    .replacingOccurrences(of: ">", with: "&gt;")

                let font = attrs[.font] as? UIFont
                let traits = font?.fontDescriptor.symbolicTraits ?? []
                let isBold = traits.contains(.traitBold)
                let isItalic = traits.contains(.traitItalic)
                var segment = text
                if isItalic { segment = "<em>\(segment)</em>" }
                if isBold { segment = "<strong>\(segment)</strong>" }
                result += segment
            }
            return result
        }
    }
}
