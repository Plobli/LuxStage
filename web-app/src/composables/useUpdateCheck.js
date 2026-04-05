import { ref } from 'vue'

// Singleton-State — wird von App.vue gelesen und von SettingsView.vue zurückgesetzt
export const updateAvailable = ref(false)
