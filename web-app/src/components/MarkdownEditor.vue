<template>
  <div>
    <!-- Toolbar -->
    <div v-if="editor" class="flex items-center gap-0.5 mb-2 flex-wrap">
      <button
        type="button"
        @mousedown.prevent="editor.chain().focus().toggleBold().run()"
        :class="editor.isActive('bold') ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'"
        class="rounded px-2 py-1 text-sm font-bold transition-colors"
        :title="t('editor.bold')"
      >B</button>
      <button
        type="button"
        @mousedown.prevent="editor.chain().focus().toggleItalic().run()"
        :class="editor.isActive('italic') ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'"
        class="rounded px-2 py-1 text-sm italic transition-colors"
        :title="t('editor.italic')"
      >I</button>
      <div class="w-px h-4 bg-white/10 mx-1" />
      <button
        type="button"
        @mousedown.prevent="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        :class="editor.isActive('heading', { level: 3 }) ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'"
        class="rounded px-2 py-1 text-sm font-semibold transition-colors"
        :title="t('editor.heading')"
      >H</button>
      <div class="w-px h-4 bg-white/10 mx-1" />
      <button
        type="button"
        @mousedown.prevent="editor.chain().focus().toggleBulletList().run()"
        :class="editor.isActive('bulletList') ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'"
        class="rounded px-2 py-1 text-sm transition-colors"
        :title="t('editor.list.bullet')"
      >≡</button>
      <button
        type="button"
        @mousedown.prevent="editor.chain().focus().toggleOrderedList().run()"
        :class="editor.isActive('orderedList') ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'"
        class="rounded px-2 py-1 text-sm transition-colors"
        :title="t('editor.list.ordered')"
      >1.</button>
    </div>

    <!-- Editor Content -->
    <EditorContent
      :editor="editor"
      class="tiptap-content min-h-[80px] text-sm text-gray-200 focus-within:outline-none [&_.tiptap]:outline-none [&_.tiptap]:min-h-[80px] [&_.tiptap_p]:my-1 [&_.tiptap_h3]:text-base [&_.tiptap_h3]:font-semibold [&_.tiptap_h3]:text-white [&_.tiptap_h3]:mt-3 [&_.tiptap_h3]:mb-1 [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-4 [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-4 [&_.tiptap_li]:my-0.5 [&_.tiptap_strong]:text-white [&_.tiptap_strong]:font-semibold [&_.tiptap_em]:italic"
    />
  </div>
</template>

<script setup>
import { watch, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import { useLocale } from '../composables/useLocale.js'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'

const { t } = useLocale()
const props = defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])

let externalValue = props.modelValue

const editor = useEditor({
  extensions: [StarterKit, Markdown],
  content: props.modelValue,
  editorProps: { attributes: { class: 'tiptap' } },
  onUpdate({ editor }) {
    const md = editor.storage.markdown.getMarkdown()
    if (md === externalValue) return
    emit('update:modelValue', md)
  },
})

watch(() => props.modelValue, (val) => {
  if (!editor.value) return
  const current = editor.value.storage.markdown.getMarkdown()
  if (val !== current) {
    externalValue = val
    editor.value.commands.setContent(val, false, { preserveWhitespace: 'full' })
  }
}, { flush: 'post' })

onBeforeUnmount(() => editor.value?.destroy())
</script>
