import { ref, type Ref } from 'vue'

const open = ref(false)
const title = ref('')
const message = ref('')
const confirmLabel = ref('')
const cancelLabel = ref('')
let resolveFn: ((v: boolean) => void) | null = null

export function useConfirmDialog() {
  return { open, title, message, confirmLabel, cancelLabel, resolveFn }
}

export interface ConfirmOptions {
  t: (key: string, params?: any) => string;
  titleKey: string;
  titleParams?: any;
  messageKey?: string;
  messageParams?: any;
  confirmKey?: string;
  cancelKey?: string;
}

export function useConfirm() {
  function confirm({ 
    t, 
    titleKey, 
    titleParams, 
    messageKey, 
    messageParams, 
    confirmKey = 'action.delete', 
    cancelKey = 'action.cancel' 
  }: ConfirmOptions): Promise<boolean> {
    // If a dialog is already open, dismiss it as cancelled before opening the new one
    if (open.value && resolveFn) {
      const prev = resolveFn
      resolveFn = null
      prev(false)
    }
    return new Promise<boolean>((resolve) => {
      title.value = t(titleKey, titleParams)
      message.value = messageKey ? t(messageKey, messageParams) : ''
      confirmLabel.value = t(confirmKey)
      cancelLabel.value = t(cancelKey)
      resolveFn = resolve
      open.value = true
    })
  }
  return { confirm }
}

export function resolveConfirm(value: boolean): void {
  if (resolveFn) {
    const fn = resolveFn
    resolveFn = null
    open.value = false
    fn(value)
  }
}

