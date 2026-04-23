import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router/index.js'
import './style.css'

// System-Theme anwenden und bei Änderungen aktualisieren
function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', dark)
}
const mq = window.matchMedia('(prefers-color-scheme: dark)')
applyTheme(mq.matches)
mq.addEventListener('change', e => applyTheme(e.matches))

createApp(App).use(router).mount('#app')
