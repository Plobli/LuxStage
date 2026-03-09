import { createI18n } from 'vue-i18n'
import de from '../../../shared/locales/de.json'
import en from '../../../shared/locales/en.json'

const savedLocale = localStorage.getItem('locale') || 'de'

export const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'de',
  messages: { de, en },
})
