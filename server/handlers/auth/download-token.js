import { issueDownloadToken } from '../../auth.js'
import { json } from '../../helpers.js'

export async function downloadTokenHandler(req, res) {
  return json(res, 200, { token: issueDownloadToken(req.user.username, req.user.role) })
}
