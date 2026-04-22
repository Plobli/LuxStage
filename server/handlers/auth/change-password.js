import { json } from '../../helpers.js'
import * as db from '../../db.js'
import bcrypt from 'bcrypt'

export async function changePasswordHandler(req, res) {
  const { currentPassword, newPassword } = req.body
  if (!newPassword || newPassword.length < 8) {
    return json(res, 400, { error: 'Passwort zu kurz (min. 8 Zeichen)' })
  }

  const storedPassword = db.getDbPassword(req.user.username)
  const pwOk = storedPassword?.startsWith('$2')
    ? await bcrypt.compare(currentPassword, storedPassword)
    : currentPassword === storedPassword

  if (!pwOk) {
    return json(res, 403, { error: 'Aktuelles Passwort falsch' })
  }

  await db.changePassword(req.user.username, newPassword, 0)
  return json(res, 200, { ok: true })
}
