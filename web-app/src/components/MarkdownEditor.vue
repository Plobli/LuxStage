<template>
  <div class="md-editor">
    <div v-if="editor" class="md-toolbar">
      <button type="button" :class="{ active: editor.isActive('bold') }"
        @mousedown.prevent="editor.chain().focus().toggleBold().run()"><b>{{ t('editor.bold') }}</b></button>
      <button type="button" :class="{ active: editor.isActive('italic') }"
        @mousedown.prevent="editor.chain().focus().toggleItalic().run()"><i>{{ t('editor.italic') }}</i></button>
      <span class="md-toolbar-sep"></span>
      <button type="button" :class="{ active: editor.isActive('heading', { level: 2 }) }"
        @mousedown.prevent="editor.chain().focus().toggleHeading({ level: 2 }).run()">{{ t('editor.h2') }}</button>
      <button type="button" :class="{ active: editor.isActive('heading', { level: 3 }) }"
        @mousedown.prevent="editor.chain().focus().toggleHeading({ level: 3 }).run()">{{ t('editor.h3') }}</button>
      <span class="md-toolbar-sep"></span>
      <button type="button" :class="{ active: editor.isActive('bulletList') }"
        @mousedown.prevent="editor.chain().focus().toggleBulletList().run()">{{ t('editor.list.bullet') }}</button>
      <button type="button" :class="{ active: editor.isActive('orderedList') }"
        @mousedown.prevent="editor.chain().focus().toggleOrderedList().run()">{{ t('editor.list.ordered') }}</button>
    </div>
    <EditorContent :editor="editor" class="md-content" />
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
  editorProps: { attributes: { class: 'md-editor-inner' } },
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
    editor.value.commands.setContent(val)
  }
})

onBeforeUnmount(() => editor.value?.destroy())
</script>
