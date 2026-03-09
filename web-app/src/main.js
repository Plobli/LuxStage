import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router/index.js'
import { i18n } from './i18n/index.js'
import { verifyAuth } from './api/pocketbase.js'
import './style.css'

// Verify stored auth token against the server before mounting.
// This clears stale tokens (e.g. after a DB reset) so users land on /login.
verifyAuth().finally(() => {
  const app = createApp(App)
  app.use(router)
  app.use(i18n)
  app.mount('#app')
})
