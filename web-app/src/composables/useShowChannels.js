import { ref, computed } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { fetchChannels, saveChannels, mergeChannels, parseChannelsCsv } from '../api/channels.js'
import { updateMeta } from '../api/shows.js'
import { useUndoRedo } from './useUndoRedo.js'

export function useShowChannels({ 
  showId, 
  meta, 
  setupMarkdown, 
  sectionContents, 
  sectionDefs, 
  persistSetupDebounced, 
  persistSectionsDebounced,
  persistSections,
  t, 
  confirm 
}) {
  const channels = ref([])
  const channelsSaving = ref(false)
  const search = ref('')
  
  const eosActiveChannels = ref(null)
  const eosMergePreview = ref({ open: false, newActive: [], nowGone: [], untouched: [] })
  let _eosMergeResolve = null
  let ignoreSseCount = 0

  const persistChannels = useDebounceFn(async () => {
    ignoreSseCount++
    try {
      await saveChannels(showId, channels.value)
      if (meta.value) meta.value.datum = new Date().toISOString().split('T')[0]
    } finally {
      channelsSaving.value = false
    }
  }, 50)

  function scheduleChannelsSave() {
    channelsSaving.value = true
    persistChannels()
  }

  const { initSnapshot, recordFocus, commitFocus, pushSnapshot, undo, redo, canUndo, canRedo } =
    useUndoRedo(
      () => ({
        channels: channels.value,
        sectionContents: [...sectionContents.value.entries()],
        sectionDefs: sectionDefs.value,
        meta: meta.value,
        setupMarkdown: setupMarkdown.value,
      }),
      (snap) => {
        channels.value = snap.channels
        sectionContents.value = new Map(snap.sectionContents)
        sectionDefs.value = snap.sectionDefs
        meta.value = snap.meta
        setupMarkdown.value = snap.setupMarkdown
      },
      () => {
        persistChannels?.cancel?.()
        persistSetupDebounced?.cancel?.()
        persistSectionsDebounced?.cancel?.()
      },
      () => {
        channelsSaving.value = true
        persistChannels()
        persistSetupDebounced()
        persistSections()
      },
      `undoredo-${showId}`
    )

  function onUndoRedoKeydown(e) {
    const focused = document.activeElement
    const isEditing = focused && (
      focused.tagName === 'INPUT' ||
      focused.tagName === 'TEXTAREA' ||
      focused.isContentEditable
    )
    if (isEditing) return

    const isMac = navigator.userAgentData?.platform === 'macOS' || /Mac/.test(navigator.userAgent)
    const mod = isMac ? e.metaKey : e.ctrlKey

    if (mod && !e.shiftKey && e.key === 'z') {
      e.preventDefault()
      undo()
    } else if (
      (mod && e.shiftKey && e.key === 'z') ||
      (mod && e.shiftKey && e.key === 'Z') ||
      (!isMac && mod && e.key === 'y')
    ) {
      e.preventDefault()
      redo()
    }
  }

  const dupWarning = computed(() => {
    const addresses = channels.value.map(c => c.address).filter(Boolean)
    return addresses.length !== new Set(addresses).size
  })

  const dupChannelNrs = computed(() => {
    const seen = new Set()
    const dups = new Set()
    for (const ch of channels.value) {
      if (ch.channel && seen.has(ch.channel)) dups.add(ch.channel)
      seen.add(ch.channel)
    }
    return dups
  })

  const dupChannelWarning = computed(() => dupChannelNrs.value.size > 0)

  const groupedChannels = computed(() => {
    const q = search.value.toLowerCase()
    let chs = q
      ? [...channels.value].sort((a, b) => parseInt(a.channel) - parseInt(b.channel))
      : [...channels.value]
    if (q) {
      chs = chs.filter(ch =>
        ch.channel?.includes(q) ||
        ch.device?.toLowerCase().includes(q) ||
        ch.notes?.toLowerCase().includes(q) ||
        ch.position?.toLowerCase().includes(q)
      )
    }
    const map = new Map()
    for (const ch of chs) {
      const pos = ch.position || ''
      if (!map.has(pos)) map.set(pos, [])
      map.get(pos).push(ch)
    }
    return [...map.entries()].map(([position, channels]) => ({ position, channels }))
  })

  async function deleteChannel(ch) {
    const ok = await confirm({ t, titleKey: 'show.channel.delete.confirm', messageParams: { channel: ch.channel }, confirmKey: 'action.delete', cancelKey: 'action.cancel' })
    if (!ok) return
    pushSnapshot()
    channels.value = channels.value.filter(c => c !== ch)
    scheduleChannelsSave()
  }

  function onCsvImportSelected(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      const imported = parseChannelsCsv(e.target.result)
      if (imported.length === 0) return
      pushSnapshot()
      channels.value = mergeChannels(channels.value, imported)
      scheduleChannelsSave()
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  function parseEosCsv(text) {
    const lines = text.split(/\r?\n/)
    if (lines[0].trim() !== 'START_LEVELS') {
      return { activeChannels: null, error: 'eos.import.error.invalid' }
    }
    const headerIdx = lines.findIndex(l => l.startsWith('TARGET_TYPE,'))
    if (headerIdx === -1) return { activeChannels: null, error: 'eos.import.error.parse' }
    const headers = lines[headerIdx].split(',')
    const colChannel   = headers.indexOf('CHANNEL')
    const colParamType = headers.indexOf('PARAMETER_TYPE_AS_TEXT')
    const colLevel     = headers.indexOf('LEVEL')
    if (colChannel === -1 || colParamType === -1 || colLevel === -1) {
      return { activeChannels: null, error: 'eos.import.error.parse' }
    }
    const active = new Set()
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const cols = lines[i].split(',')
      if (cols[colParamType] === 'Intens' && parseFloat(cols[colLevel]) > 0) {
        const ch = (cols[colChannel] ?? '').trim()
        if (ch) active.add(ch)
      }
    }
    return { activeChannels: [...active], error: null }
  }

  async function persistEosChannels() {
    await updateMeta(showId, { ...meta.value, setupMarkdown: setupMarkdown.value, eosActiveChannels: eosActiveChannels.value })
  }

  async function onEosFileSelected(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const text = await file.text()
    const { activeChannels, error } = parseEosCsv(text)

    if (error) {
      window.alert(t(error))
      return
    }

    const channelsWithNotes = new Set(
      channels.value.filter(ch => (ch.notes ?? '').trim().length > 0).map(ch => String(ch.channel))
    )

    function chLabel(nr) {
      const ch = channels.value.find(c => String(c.channel) === nr)
      if (!ch) return ''
      return [ch.device, ch.position].filter(Boolean).join(' / ')
    }

    const prev = eosActiveChannels.value ?? []
    const prevTracked = prev.map(ch => ch.startsWith('-') ? ch.slice(1) : ch)
      .filter(nr => !channelsWithNotes.has(nr))

    const newActiveNrs  = activeChannels.filter(nr => !channelsWithNotes.has(nr))
    const nowGoneNrs    = prevTracked.filter(nr => !activeChannels.includes(nr))
    const untouchedNrs  = activeChannels.filter(nr => channelsWithNotes.has(nr))

    const ok = await new Promise(resolve => {
      _eosMergeResolve = resolve
      eosMergePreview.value = {
        open: true,
        newActive:  newActiveNrs.map(nr => ({ nr, label: chLabel(nr) })),
        nowGone:    nowGoneNrs.map(nr => ({ nr, label: chLabel(nr) })),
        untouched:  untouchedNrs.map(nr => ({ nr, label: chLabel(nr) })),
      }
    })
    eosMergePreview.value.open = false
    if (!ok) return

    const existingNrs = new Set(channels.value.map(ch => String(ch.channel)))
    const missingNrs = newActiveNrs.filter(nr => !existingNrs.has(nr))
    if (missingNrs.length > 0) {
      const newChannels = missingNrs.map(nr => ({ channel: nr, address: '', device: '', position: '', color: '', notes: '' }))
      channels.value = [...channels.value, ...newChannels]
        .sort((a, b) => parseInt(a.channel) - parseInt(b.channel))
      await saveChannels(showId, channels.value)
    }

    eosActiveChannels.value = [
      ...newActiveNrs,
      ...nowGoneNrs.map(nr => `-${nr}`),
    ]
    await persistEosChannels()
  }

  function resolveEosMergePreview(value) {
    _eosMergeResolve?.(value)
    _eosMergeResolve = null
  }

  function channelStatus(ch) {
    const notes = (ch.notes ?? '').trim()
    if (notes.length > 0) return 'active'
    const nr = String(ch.channel)
    if (!eosActiveChannels.value) return 'default'
    if (eosActiveChannels.value.includes(nr)) return 'eos'
    if (eosActiveChannels.value.includes(`-${nr}`)) return 'default'
    return 'default'
  }

  async function toggleChannelStatus(ch) {
    if (!eosActiveChannels.value) return
    const nr = String(ch.channel)
    const status = channelStatus(ch)
    if (status === 'active') return

    if (status === 'eos') {
      eosActiveChannels.value = eosActiveChannels.value.map(c => c === nr ? `-${nr}` : c)
    } else {
      const hasInactive = eosActiveChannels.value.includes(`-${nr}`)
      if (hasInactive) {
        eosActiveChannels.value = eosActiveChannels.value.map(c => c === `-${nr}` ? nr : c)
      }
    }
    await persistEosChannels()
  }

  async function loadChannels() {
    const chs = await fetchChannels(showId)
    channels.value = Array.isArray(chs) ? chs : []
  }

  async function handleChannelsSse() {
    if (ignoreSseCount > 0) { ignoreSseCount--; return }
    const chs = await fetchChannels(showId)
    channels.value = Array.isArray(chs) ? chs : []
  }

  return {
    channels,
    channelsSaving,
    search,
    eosActiveChannels,
    eosMergePreview,
    dupWarning,
    dupChannelWarning,
    dupChannelNrs,
    groupedChannels,
    scheduleChannelsSave,
    persistChannels,
    deleteChannel,
    onCsvImportSelected,
    onEosFileSelected,
    resolveEosMergePreview,
    channelStatus,
    toggleChannelStatus,
    initSnapshot,
    recordFocus,
    commitFocus,
    pushSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
    onUndoRedoKeydown,
    loadChannels,
    handleChannelsSse
  }
}
