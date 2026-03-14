import SwiftUI
import WebKit

/// Renders Markdown content as formatted text using a lightweight WKWebView.
/// The server stores setup notes as standard Markdown — this view converts it to HTML for display.
struct MarkdownTextView: UIViewRepresentable {
    let markdown: String
    @Environment(\.colorScheme) var colorScheme

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView(frame: .zero)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        let textColor = colorScheme == .dark ? "#FFFFFF" : "#000000"
        // Minimal Markdown → HTML conversion (headings, bold, italic, lists)
        let html = convertMarkdown(markdown)
        let styled = """
        <html>
        <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: -apple-system, sans-serif;
            font-size: 15px;
            color: \(textColor);
            margin: 0; padding: 0;
            background: transparent;
          }
          h2 { font-size: 16px; font-weight: 700; margin: 8px 0 4px; }
          h3 { font-size: 15px; font-weight: 600; margin: 6px 0 2px; }
          ul, ol { padding-left: 20px; margin: 4px 0; }
          li { margin: 2px 0; }
          p { margin: 2px 0; }
          strong { font-weight: 600; }
          em { font-style: italic; }
        </style>
        </head>
        <body>\(html)</body>
        </html>
        """
        webView.loadHTMLString(styled, baseURL: nil)
    }

    // MARK: - Minimal Markdown Parser

    private func convertMarkdown(_ md: String) -> String {
        var lines = md.components(separatedBy: "\n")
        var html = ""
        var inList = false

        for line in lines {
            if line.hasPrefix("## ") {
                if inList { html += "</ul>"; inList = false }
                html += "<h2>\(escape(String(line.dropFirst(3))))</h2>"
            } else if line.hasPrefix("### ") {
                if inList { html += "</ul>"; inList = false }
                html += "<h3>\(escape(String(line.dropFirst(4))))</h3>"
            } else if line.hasPrefix("- ") || line.hasPrefix("* ") {
                if !inList { html += "<ul>"; inList = true }
                html += "<li>\(inlineFormat(escape(String(line.dropFirst(2)))))</li>"
            } else if line.trimmingCharacters(in: .whitespaces).isEmpty {
                if inList { html += "</ul>"; inList = false }
            } else {
                if inList { html += "</ul>"; inList = false }
                html += "<p>\(inlineFormat(escape(line)))</p>"
            }
        }
        if inList { html += "</ul>" }
        return html
    }

    private func escape(_ s: String) -> String {
        s.replacingOccurrences(of: "&", with: "&amp;")
         .replacingOccurrences(of: "<", with: "&lt;")
         .replacingOccurrences(of: ">", with: "&gt;")
    }

    private func inlineFormat(_ s: String) -> String {
        var result = s
        // **bold**
        result = result.replacingOccurrences(of: #"\*\*(.+?)\*\*"#, with: "<strong>$1</strong>", options: .regularExpression)
        // *italic*
        result = result.replacingOccurrences(of: #"\*(.+?)\*"#, with: "<em>$1</em>", options: .regularExpression)
        return result
    }
}

#Preview {
    MarkdownTextView(markdown: "## Hängerei\n- 641-643 LKS Nanopix\n- **720** Rush Portal LKS")
        .padding()
}
