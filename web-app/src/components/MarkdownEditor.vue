<template>
  <div class="overflow-hidden rounded-2xl border border-border/50 bg-background/35">
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
    </div>

    <!-- Editor Content -->
    <EditorContent
      :editor="editor"
      class="tiptap-content min-h-[120px] bg-transparent px-4 py-4 text-sm text-foreground focus-within:outline-none [&_.tiptap]:min-h-[120px] [&_.tiptap]:outline-none [&_.tiptap]:text-foreground [&_.tiptap_p]:my-1.5 [&_.tiptap_h3]:mb-1 [&_.tiptap_h3]:mt-3 [&_.tiptap_h3]:text-sm [&_.tiptap_h3]:font-semibold [&_.tiptap_h3]:text-foreground [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-5 [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-5 [&_.tiptap_li]:my-1 [&_.tiptap_strong]:font-semibold [&_.tiptap_strong]:text-foreground [&_.tiptap_em]:italic"
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

const editor = useEditor({
  extensions: [StarterKit, Markdown],
  content: props.modelValue,
  editorProps: { attributes: { class: 'tiptap' } },
  onUpdate({ editor }) {
    const md = editor.storage.markdown.getMarkdown()
    emit('update:modelValue', md)
  },
})

watch(() => props.modelValue, (val) => {
  if (!editor.value || editor.value.isFocused) return
  const current = editor.value.storage.markdown.getMarkdown()
  if (val === current) return
  editor.value.commands.setContent(val, false, { preserveWhitespace: 'full' })
}, { flush: 'post' })

onBeforeUnmount(() => editor.value?.destroy())
</script>
