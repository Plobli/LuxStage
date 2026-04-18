/**
 * useLocale — schlankes i18n ohne vue-i18n
 * Lädt de.json / en.json aus shared/locales/
 */
import { ref, computed } from 'vue'
import de from '../../../shared/locales/de.json'
import en from '../../../shared/locales/en.json'

const messages = { de, en }
const locale = ref(localStorage.getItem('locale') || 'de')

// Sprachänderungen aus anderen Tabs/Fenstern übernehmen
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'locale' && e.newValue && messages[e.newValue]) {
      locale.value = e.newValue
    }
  })
}

export function useLocale() {
  function t(key, params) {
    let val = messages[locale.value]?.[key] ?? messages['de']?.[key] ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        val = val.replaceAll(`{${k}}`, v)
      }
    }
    return val
  }

  function setLocale(lang) {
    if (messages[lang]) {
      locale.value = lang
      localStorage.setItem('locale', lang)
    }
  }

  return { t, locale: computed(() => locale.value), setLocale }
}
