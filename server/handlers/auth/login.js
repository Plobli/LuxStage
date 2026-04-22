import { login } from '../../auth.js'
import { json } from '../../helpers.js'

export async function loginHandler(req, res) {
  const { username, password } = req.body
  const result = await login(username, password)
  if (!result) {
    req.recordFailedLogin()
    return json(res, 401, { error: 'Ungültige Anmeldedaten' })
  }
  return json(res, 200, result)
}
