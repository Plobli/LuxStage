<template>
  <div>
    <!-- Toolbar -->
    <div v-if="editor" class="flex items-center gap-0.5 mb-2 flex-wrap">
      <Button
        variant="ghost"
        size="sm"
        @mousedown.prevent="editor.chain().focus().toggleBold().run()"
        :class="editor.isActive('bold') ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'"
        class="h-7 px-2 font-bold transition-colors"
        :title="t('editor.bold')"
      >B</Button>
      <Button
        variant="ghost"
        size="sm"
        @mousedown.prevent="editor.chain().focus().toggleItalic().run()"
        :class="editor.isActive('italic') ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'"
        class="h-7 px-2 italic transition-colors"
        :title="t('editor.italic')"
      >I</Button>
      <div class="w-px h-4 bg-white/10 mx-1" />
      <Button
        variant="ghost"
        size="sm"
        @mousedown.prevent="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        :class="editor.isActive('heading', { level: 3 }) ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'"
        class="h-7 px-2 font-semibold transition-colors"
        :title="t('editor.heading')"
      >H</Button>
      <div class="w-px h-4 bg-white/10 mx-1" />
      <Button
        variant="ghost"
        size="sm"
        @mousedown.prevent="editor.chain().focus().toggleBulletList().run()"
        :class="editor.isActive('bulletList') ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'"
        class="h-7 px-2 transition-colors"
        :title="t('editor.list.bullet')"
      >≡</Button>
      <Button
        variant="ghost"
        size="sm"
        @mousedown.prevent="editor.chain().focus().toggleOrderedList().run()"
        :class="editor.isActive('orderedList') ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'"
        class="h-7 px-2 transition-colors"
        :title="t('editor.list.ordered')"
      >1.</Button>
    </div>

    <!-- Editor Content -->
    <EditorContent
      :editor="editor"
      class="tiptap-content min-h-[80px] text-sm text-gray-200 focus-within:outline-none [&_.tiptap]:outline-none [&_.tiptap]:min-h-[80px] [&_.tiptap_p]:my-1 [&_.tiptap_h3]:text-sm [&_.tiptap_h3]:font-semibold [&_.tiptap_h3]:text-white [&_.tiptap_h3]:mt-3 [&_.tiptap_h3]:mb-1 [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-4 [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-4 [&_.tiptap_li]:my-0.5 [&_.tiptap_strong]:text-white [&_.tiptap_strong]:font-semibold [&_.tiptap_em]:italic"
    />
  </div>
</template>

<script setup>
import { watch, onBeforeUnmount } from 'vue'
import { Button } from '@/components/ui/button'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import { useLocale } from '../composables/useLocale.js'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'

const { t } = useLocale()
const props = defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])

let externalValue = props.modelValue
let settingContent = false   // verhindert Echo während setContent()

const editor = useEditor({
  extensions: [StarterKit, Markdown],
  content: props.modelValue,
  editorProps: { attributes: { class: 'tiptap' } },
  onUpdate({ editor }) {
    if (settingContent) return
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
    settingContent = true
    editor.value.commands.setContent(val, false, { preserveWhitespace: 'full' })
    settingContent = false
  }
}, { flush: 'post' })

onBeforeUnmount(() => editor.value?.destroy())
</script>
