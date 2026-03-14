/**
 * useMarkdownEditor — Toast UI Editor als WYSIWYG mit Markdown-Ausgabe
 * Nutzer sehen formattierten Text (kein Markdown-Syntax sichtbar).
 * Gespeichert wird Standard-Markdown.
 */
import { onMounted, onBeforeUnmount, ref } from 'vue'
import Editor from '@toast-ui/editor'
import '@toast-ui/editor/dist/toastui-editor.css'

export function useMarkdownEditor(containerRef, options = {}) {
  let editor = null
  const ready = ref(false)

  onMounted(() => {
    editor = new Editor({
      el: containerRef.value,
      height: options.height || '400px',
      initialEditType: 'wysiwyg',   // WYSIWYG-Modus als Standard
      previewStyle: 'vertical',
      hideModeSwitch: false,         // Nutzer kann zwischen WYSIWYG und Markdown wechseln
      initialValue: options.initialValue || '',
      language: 'de-DE',
      toolbarItems: [
        ['heading', 'bold', 'italic'],
        ['ul', 'ol'],
        ['hr'],
      ],
      ...options.editorOptions,
    })
    ready.value = true
    if (options.onChange) {
      editor.on('change', () => options.onChange(editor.getMarkdown()))
    }
  })

  onBeforeUnmount(() => {
    editor?.destroy()
    editor = null
  })

  return {
    ready,
    getMarkdown: () => editor?.getMarkdown() ?? '',
    setMarkdown: (md) => editor?.setMarkdown(md),
  }
}
