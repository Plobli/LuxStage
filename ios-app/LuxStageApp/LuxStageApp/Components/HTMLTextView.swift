import SwiftUI
import WebKit

/// Renders Tiptap/HTML content as formatted text using a lightweight WKWebView.
struct HTMLTextView: UIViewRepresentable {
    let html: String

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        let styled = """
        <html>
        <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: -apple-system, sans-serif;
            font-size: 15px;
            color: \(colorSchemeCSS);
            margin: 0; padding: 0;
            background: transparent;
          }
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

    private var colorSchemeCSS: String {
        // Detect dark mode
        if UITraitCollection.current.userInterfaceStyle == .dark {
            return "#FFFFFF"
        } else {
            return "#000000"
        }
    }
}
