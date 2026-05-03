<template>
  <div class="overflow-hidden bg-background/35" :class="$attrs.class ?? 'rounded-2xl border border-border/50'">
    <!-- Toolbar -->
    <div v-if="editor" class="flex flex-wrap items-center gap-1 border-b border-border/40 bg-muted/10 px-3 py-2">
      <Toggle
        size="sm"
        :pressed="editor.isActive('bold')"
        @mousedown.prevent="editor.chain().focus().toggleBold().run()"
        class="h-8 rounded-full px-3 font-bold data-[state=on]:bg-background data-[state=on]:text-foreground"
        :title="t('editor.bold')"
      >B</Toggle>
      <Toggle
        size="sm"
        :pressed="editor.isActive('italic')"
        @mousedown.prevent="editor.chain().focus().toggleItalic().run()"
        class="h-8 rounded-full px-3 italic data-[state=on]:bg-background data-[state=on]:text-foreground"
        :title="t('editor.italic')"
      >I</Toggle>
      <Separator orientation="vertical" class="mx-1 h-4" />
      <Toggle
        size="sm"
        :pressed="editor.isActive('heading', { level: 3 })"
        @mousedown.prevent="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        class="h-8 rounded-full px-3 font-semibold data-[state=on]:bg-background data-[state=on]:text-foreground"
        :title="t('editor.heading')"
      >H</Toggle>
      <Separator orientation="vertical" class="mx-1 h-4" />
      <Toggle
        size="sm"
        :pressed="editor.isActive('bulletList')"
        @mousedown.prevent="editor.chain().focus().toggleBulletList().run()"
        class="h-8 rounded-full px-3 data-[state=on]:bg-background data-[state=on]:text-foreground"
        :title="t('editor.list.bullet')"
      >≡</Toggle>
      <Toggle
        size="sm"
        :pressed="editor.isActive('orderedList')"
        @mousedown.prevent="editor.chain().focus().toggleOrderedList().run()"
        class="h-8 rounded-full px-3 data-[state=on]:bg-background data-[state=on]:text-foreground"
        :title="t('editor.list.ordered')"
      >1.</Toggle>
      <Separator orientation="vertical" class="mx-1 h-4" />
      <button
        @mousedown.prevent="insertTable"
        class="h-8 rounded-full px-3 text-sm text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
        :title="t('editor.table.insert')"
      >⊞</button>
      <template v-if="editor.isActive('table')">
        <button
          @mousedown.prevent="editor.chain().focus().addColumnAfter().run()"
          class="h-8 rounded-full px-2 text-xs text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
          :title="t('editor.table.addCol')"
        >+Sp</button>
        <button
          @mousedown.prevent="editor.chain().focus().addRowAfter().run()"
          class="h-8 rounded-full px-2 text-xs text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
          :title="t('editor.table.addRow')"
        >+Ze</button>
        <button
          @mousedown.prevent="editor.chain().focus().deleteColumn().run()"
          class="h-8 rounded-full px-2 text-xs text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
          :title="t('editor.table.delCol')"
        >−Sp</button>
        <button
          @mousedown.prevent="editor.chain().focus().deleteRow().run()"
          class="h-8 rounded-full px-2 text-xs text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
          :title="t('editor.table.delRow')"
        >−Ze</button>
        <button
          @mousedown.prevent="editor.chain().focus().deleteTable().run()"
          class="h-8 rounded-full px-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
          :title="t('editor.table.delete')"
        >✕Tab</button>
      </template>
    </div>

    <!-- Editor Content -->
    <EditorContent
      :editor="editor"
      class="tiptap-content min-h-[120px] bg-transparent px-4 py-4 text-sm text-foreground focus-within:outline-none [&_.tiptap]:min-h-[120px] [&_.tiptap]:outline-none [&_.tiptap]:text-foreground [&_.tiptap_p]:my-1.5 [&_.tiptap_h3]:mb-1 [&_.tiptap_h3]:mt-3 [&_.tiptap_h3]:text-sm [&_.tiptap_h3]:font-semibold [&_.tiptap_h3]:text-foreground [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-5 [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-5 [&_.tiptap_li]:my-1 [&_.tiptap_strong]:font-semibold [&_.tiptap_strong]:text-foreground [&_.tiptap_em]:italic [&_.tiptap_table]:w-full [&_.tiptap_table]:border-collapse [&_.tiptap_table]:my-3 [&_.tiptap_td]:border [&_.tiptap_td]:border-border/60 [&_.tiptap_td]:px-3 [&_.tiptap_td]:py-1.5 [&_.tiptap_td]:text-sm [&_.tiptap_td]:align-top [&_.tiptap_th]:border [&_.tiptap_th]:border-border/60 [&_.tiptap_th]:px-3 [&_.tiptap_th]:py-1.5 [&_.tiptap_th]:text-sm [&_.tiptap_th]:font-semibold [&_.tiptap_th]:bg-muted/40 [&_.tiptap_th]:text-left [&_.tiptap_.selectedCell]:bg-muted/30"
    />
  </div>
</template>

<script setup>
defineOptions({ inheritAttrs: false })
import { watch, onBeforeUnmount } from 'vue'
import { Toggle } from '@/components/ui/toggle'
import { Separator } from '@/components/ui/separator'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import { useLocale } from '../composables/useLocale.js'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'

const { t } = useLocale()
const props = defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])

const editor = useEditor({
  extensions: [
    StarterKit,
    Markdown.configure({
      html: true,
      transformCopiedText: true,
      transformPastedText: true,
      serializer: {
        table: ({ node }) => {
          const rows = []
          node.forEach((tableRow) => {
            const cells = []
            tableRow.forEach((cell) => {
              cells.push(cell.textContent)
            })
            rows.push('| ' + cells.join(' | ') + ' |')
          })
          if (rows.length > 0) {
            const headerCount = node.firstChild?.childCount || 0
            rows.splice(1, 0, '| ' + Array(headerCount).fill('---').join(' | ') + ' |')
          }
          return rows.join('\n') + '\n'
        },
        tableRow: () => '',
        tableCell: () => '',
        tableHeader: () => '',
      },
    }),
    Table.configure({ resizable: false }),
    TableRow,
    TableCell,
    TableHeader,
  ],
  content: props.modelValue,
  editorProps: {
    attributes: { class: 'tiptap' },
    handlePaste(view, event) {
      // HTML-Paste (z.B. aus Word/Numbers) → Tiptap verarbeitet es nativ mit Table-Support
      const html = event.clipboardData?.getData('text/html')
      if (html) return false // Tiptap-Default übernimmt (parst HTML inkl. Tabellen)
      // Plain-text Paste
      const text = event.clipboardData?.getData('text/plain')
      if (!text) return false
      event.preventDefault()
      view.dispatch(view.state.tr.insertText(text))
      return true
    },
  },
  onUpdate({ editor }) {
    const md = editor.storage.markdown.getMarkdown()
    emit('update:modelValue', md)
  },
})

function insertTable() {
  editor.value?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
}

watch(() => props.modelValue, (val) => {
  if (!editor.value || editor.value.isFocused) return
  const current = editor.value.storage.markdown.getMarkdown()
  if (val === current) return
  editor.value.commands.setContent(val, false, { preserveWhitespace: 'full' })
}, { flush: 'post' })

onBeforeUnmount(() => editor.value?.destroy())
</script>
