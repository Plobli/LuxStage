/**
 * useLocale — schlankes i18n ohne vue-i18n
 * Lädt de.json / en.json aus shared/locales/
 */
import { ref, computed } from 'vue'
import de from '../../../shared/locales/de.json'
import en from '../../../shared/locales/en.json'

const messages = { de, en }
const locale = ref(localStorage.getItem('locale') || 'de')

export function useLocale() {
  function t(key) {
    const keys = key.split('.')
    let val = messages[locale.value]
    for (const k of keys) {
      val = val?.[k]
      if (val === undefined) break
    }
    // Fallback auf Deutsch
    if (val === undefined) {
      val = messages['de']
      for (const k of keys) val = val?.[k]
    }
    return val ?? key
  }

  function setLocale(lang) {
    if (messages[lang]) {
      locale.value = lang
      localStorage.setItem('locale', lang)
    }
  }

  return { t, locale: computed(() => locale.value), setLocale }
}
