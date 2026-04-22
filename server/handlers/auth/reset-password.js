import { json } from '../../helpers.js'
import * as db from '../../db.js'
import { randomBytes } from 'node:crypto'

export async function resetPasswordHandler(req, res) {
  const { username } = req.body
  const allUsers = db.listUsers()
  if (!allUsers.find(u => u.username === username)) {
    return json(res, 404, { error: 'Benutzer nicht gefunden' })
  }
  const newPassword = randomBytes(6).toString('hex')
  await db.changePassword(username, newPassword, 1)
  return json(res, 200, { newPassword })
}
