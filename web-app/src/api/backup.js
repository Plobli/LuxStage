/**
 * backup.js — ZIP-Backup-Download v1.1
 * Server erstellt das ZIP aus dem data/-Ordner.
 */
import { api } from './client.js'

export function downloadBackup() {
  window.location.href = api.url('/api/backup')
}
