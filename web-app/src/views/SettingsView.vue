<template>
  <div class="page">
    <div class="page-header">
      <h2>{{ $t('nav.settings') }}</h2>
    </div>

    <section class="settings-section">
      <h3>{{ $t('settings.language') }}</h3>
      <div class="radio-group">
        <label>
          <input type="radio" v-model="locale" value="de" @change="saveLocale" />
          {{ $t('settings.language.de') }}
        </label>
        <label>
          <input type="radio" v-model="locale" value="en" @change="saveLocale" />
          {{ $t('settings.language.en') }}
        </label>
      </div>
    </section>

    <section class="settings-section">
      <h3>{{ $t('settings.server') }}</h3>
      <div class="radio-group">
        <label>
          <input type="radio" v-model="serverMode" value="vps" @change="applyServer" />
          {{ $t('settings.server.vps') }} — theater.cfrlab.de
        </label>
        <label>
          <input type="radio" v-model="serverMode" value="pi" @change="applyServer" />
          {{ $t('settings.server.pi') }}
        </label>
      </div>
      <div v-if="serverMode === 'pi'" class="field">
        <label>{{ $t('settings.server.pi_url') }}</label>
        <input v-model="piUrl" type="url" placeholder="http://192.168.1.100:8090" @change="applyServer" />
      </div>
    </section>

    <section class="settings-section">
      <h3>{{ $t('settings.channel_edit') }}</h3>
      <div class="radio-group">
        <label>
          <input type="radio" v-model="editMode" value="inline" @change="saveEditMode" />
          {{ $t('settings.channel_edit.inline') }}
        </label>
        <label>
          <input type="radio" v-model="editMode" value="dialog" @change="saveEditMode" />
          {{ $t('settings.channel_edit.dialog') }}
        </label>
      </div>
    </section>

    <section class="settings-section">
      <h3>Backup</h3>
      <div class="backup-row">
        <button class="btn-ghost" @click="doExportAll">↓ Alle Shows exportieren</button>
        <label class="btn-ghost backup-import-btn">
          ↑ Backup importieren
          <input type="file" accept=".json" @change="onImportFile" hidden />
        </label>
      </div>
      <div v-if="importPreview" class="import-preview">
        <p>{{ importPreview.shows.length }} Show(s), {{ importPreview.channels.length }} Kanäle</p>
        <div class="backup-row" style="margin-top:8px">
          <button class="btn-primary" @click="doImport" :disabled="importing">{{ importing ? '…' : 'Importieren' }}</button>
          <button class="btn-ghost" @click="importPreview = null">Abbrechen</button>
        </div>
        <p v-if="importDone" class="import-ok">✓ Import abgeschlossen</p>
      </div>
      <p v-if="importError" class="error-msg" style="margin-top:8px">{{ importError }}</p>
    </section>

    <section class="settings-section">
      <button class="btn-danger" @click="handleLogout">{{ $t('settings.logout') }}</button>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { logout, setServerUrl } from '../api/pocketbase.js'
import { exportAllBackup, parseBackupFile, importBackup } from '../api/backup.js'

const { locale } = useI18n()
const router = useRouter()

const serverMode = ref(localStorage.getItem('server_mode') || 'vps')
const editMode = ref(localStorage.getItem('channel_edit_mode') || 'inline')
const piUrl = ref(localStorage.getItem('pi_url') || 'http://192.168.1.100:8090')

const importPreview = ref(null)
const importError = ref('')
const importing = ref(false)
const importDone = ref(false)

function saveEditMode() {
  localStorage.setItem('channel_edit_mode', editMode.value)
}

function saveLocale() {
  localStorage.setItem('locale', locale.value)
}

function applyServer() {
  localStorage.setItem('server_mode', serverMode.value)
  if (serverMode.value === 'pi') {
    localStorage.setItem('pi_url', piUrl.value)
    setServerUrl(piUrl.value)
  } else {
    setServerUrl('https://theater.cfrlab.de')
  }
}

function handleLogout() {
  logout()
  router.push('/login')
}

function doExportAll() { exportAllBackup() }

async function onImportFile(e) {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file) return
  importError.value = ''
  importDone.value = false
  try {
    const data = await parseBackupFile(file)
    importPreview.value = {
      shows: data.shows ?? (data.show ? [data.show] : []),
      channels: data.channels ?? [],
      _raw: data,
    }
  } catch (err) {
    importError.value = err.message
  }
}

async function doImport() {
  if (!importPreview.value) return
  importing.value = true
  importError.value = ''
  try {
    await importBackup(importPreview.value._raw)
    importDone.value = true
    importPreview.value = null
  } catch (err) {
    importError.value = err.message
  } finally {
    importing.value = false
  }
}
</script>
