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
      <button class="btn-danger" @click="handleLogout">{{ $t('settings.logout') }}</button>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { logout, setServerUrl } from '../api/pocketbase.js'

const { locale } = useI18n()
const router = useRouter()

const serverMode = ref(localStorage.getItem('server_mode') || 'vps')
const editMode = ref(localStorage.getItem('channel_edit_mode') || 'inline')
const piUrl = ref(localStorage.getItem('pi_url') || 'http://192.168.1.100:8090')

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
</script>
