import { ref } from 'vue'

const open = ref(false)
const title = ref('')
const message = ref('')
const confirmLabel = ref('')
const cancelLabel = ref('')
let resolveFn = null

export function useConfirmDialog() {
  return { open, title, message, confirmLabel, cancelLabel, resolveFn }
}

export function useConfirm() {
  function confirm({ t, titleKey, titleParams, messageKey, messageParams, confirmKey = 'action.delete', cancelKey = 'action.cancel' }) {
    return new Promise((resolve) => {
      title.value = t(titleKey, titleParams ?? messageParams)
      message.value = messageKey ? t(messageKey, messageParams) : ''
      confirmLabel.value = t(confirmKey)
      cancelLabel.value = t(cancelKey)
      resolveFn = resolve
      open.value = true
    })
  }
  return { confirm }
}

export function resolveConfirm(value) {
  if (resolveFn) {
    const fn = resolveFn
    resolveFn = null
    open.value = false
    fn(value)
  }
}
