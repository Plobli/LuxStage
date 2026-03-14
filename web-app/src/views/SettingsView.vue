<template>
  <div class="page">
    <div class="page-header">
      <h2>{{ t('nav.settings') }}</h2>
    </div>

    <section class="settings-section">
      <h3>{{ t('settings.language') }}</h3>
      <div class="radio-group">
        <label>
          <input type="radio" :checked="locale === 'de'" value="de" @change="setLocale('de')" />
          {{ t('settings.language.de') }}
        </label>
        <label>
          <input type="radio" :checked="locale === 'en'" value="en" @change="setLocale('en')" />
          {{ t('settings.language.en') }}
        </label>
      </div>
    </section>

    <section class="settings-section">
      <h3>{{ t('settings.server') }}</h3>
      <div class="field">
        <label>Server-URL</label>
        <input v-model="serverUrl" type="url" placeholder="http://192.168.1.100:3000" @change="applyServer" />
      </div>
    </section>

    <section class="settings-section">
      <h3>Backup</h3>
      <button class="btn-ghost" @click="downloadBackup">↓ ZIP-Backup herunterladen</button>
    </section>

    <section v-if="isAdmin" class="settings-section">
      <h3>Update</h3>
      <button class="btn-ghost" :disabled="updating" @click="doUpdate">
        {{ updating ? '…' : 'Server aktualisieren (git pull)' }}
      </button>
      <p v-if="updateMsg" class="update-msg">{{ updateMsg }}</p>
    </section>

    <section class="settings-section">
      <button class="btn-danger" @click="handleLogout">{{ t('settings.logout') }}</button>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLocale } from '../composables/useLocale.js'
import { logout, setServerUrl, api } from '../api/client.js'
import { downloadBackup } from '../api/backup.js'
import { jwtDecode } from '../api/jwtDecode.js'

const { t, locale, setLocale } = useLocale()
const router = useRouter()

const serverUrl = ref(localStorage.getItem('server_url') || 'http://localhost:3000')
const updating = ref(false)
const updateMsg = ref('')

// Rolle aus JWT lesen (kein extra API-Call nötig)
const isAdmin = ref(false)
try {
  const token = localStorage.getItem('luxstage_token')
  if (token) isAdmin.value = jwtDecode(token)?.role === 'admin'
} catch { /* ignorieren */ }

function applyServer() {
  setServerUrl(serverUrl.value)
}

function handleLogout() {
  logout()
  router.push('/login')
}

async function doUpdate() {
  updating.value = true
  updateMsg.value = ''
  try {
    const res = await api.post('/api/update', {})
    updateMsg.value = '✓ Update gestartet — Server wird neu gestartet'
  } catch (e) {
    updateMsg.value = '✗ ' + e.message
  } finally {
    updating.value = false
  }
}
</script>
