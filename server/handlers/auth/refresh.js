import { signToken } from '../../auth.js'
import { json } from '../../helpers.js'

export async function refreshHandler(req, res) {
  return json(res, 200, { token: signToken(req.user.username, req.user.role) })
}
