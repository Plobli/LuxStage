<template>
  <div>
    <!-- Toolbar -->
    <div v-if="editor" class="flex items-center gap-0.5 mb-2 flex-wrap">
      <Toggle
        size="sm"
        :pressed="editor.isActive('bold')"
        @mousedown.prevent="editor.chain().focus().toggleBold().run()"
        class="h-7 px-2 font-bold"
        :title="t('editor.bold')"
      >B</Toggle>
      <Toggle
        size="sm"
        :pressed="editor.isActive('italic')"
        @mousedown.prevent="editor.chain().focus().toggleItalic().run()"
        class="h-7 px-2 italic"
        :title="t('editor.italic')"
      >I</Toggle>
      <Separator orientation="vertical" class="h-4 mx-1" />
      <Toggle
        size="sm"
        :pressed="editor.isActive('heading', { level: 3 })"
        @mousedown.prevent="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        class="h-7 px-2 font-semibold"
        :title="t('editor.heading')"
      >H</Toggle>
      <Separator orientation="vertical" class="h-4 mx-1" />
      <Toggle
        size="sm"
        :pressed="editor.isActive('bulletList')"
        @mousedown.prevent="editor.chain().focus().toggleBulletList().run()"
        class="h-7 px-2"
        :title="t('editor.list.bullet')"
      >≡</Toggle>
      <Toggle
        size="sm"
        :pressed="editor.isActive('orderedList')"
        @mousedown.prevent="editor.chain().focus().toggleOrderedList().run()"
        class="h-7 px-2"
        :title="t('editor.list.ordered')"
      >1.</Toggle>
    </div>

    <!-- Editor Content -->
    <EditorContent
      :editor="editor"
      class="tiptap-content min-h-[80px] text-sm text-foreground focus-within:outline-none [&_.tiptap]:outline-none [&_.tiptap]:min-h-[80px] [&_.tiptap_p]:my-1 [&_.tiptap_h3]:text-sm [&_.tiptap_h3]:font-semibold [&_.tiptap_h3]:text-foreground [&_.tiptap_h3]:mt-3 [&_.tiptap_h3]:mb-1 [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-4 [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-4 [&_.tiptap_li]:my-0.5 [&_.tiptap_strong]:text-foreground [&_.tiptap_strong]:font-semibold [&_.tiptap_em]:italic"
    />
  </div>
</template>

<script setup>
import { watch, onBeforeUnmount } from 'vue'
import { Toggle } from '@/components/ui/toggle'
import { Separator } from '@/components/ui/separator'
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
