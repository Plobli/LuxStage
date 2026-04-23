/**
 * useLocale — schlankes i18n ohne vue-i18n
 * Lädt de.json / en.json aus shared/locales/
 */
import { ref, computed, type ComputedRef } from 'vue'
import de from '../../../shared/locales/de.json'
import en from '../../../shared/locales/en.json'

type MessageBundle = Record<string, string>;
const messages: Record<string, MessageBundle> = { de, en }
const locale = ref(localStorage.getItem('locale') || 'de')

// Sprachänderungen aus anderen Tabs/Fenstern übernehmen
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === 'locale' && e.newValue && messages[e.newValue]) {
      locale.value = e.newValue
    }
  })
}

export interface UseLocaleReturn {
  t: (key: string, params?: Record<string, string | number>) => string;
  locale: ComputedRef<string>;
  setLocale: (lang: string) => void;
}

export function useLocale(): UseLocaleReturn {
  function t(key: string, params?: Record<string, string | number>): string {
    let val: string = messages[locale.value]?.[key] ?? messages['de']?.[key] ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        val = val.replaceAll(`{${k}}`, String(v))
      }
    }
    return val
  }

  function setLocale(lang: string): void {
    if (messages[lang]) {
      locale.value = lang
      localStorage.setItem('locale', lang)
    }
  }

  return { t, locale: computed(() => locale.value), setLocale }
}

