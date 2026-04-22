import { loginHandler } from '../handlers/auth/login.js'
import { refreshHandler } from '../handlers/auth/refresh.js'
import { downloadTokenHandler } from '../handlers/auth/download-token.js'
import { changePasswordHandler } from '../handlers/auth/change-password.js'
import { resetPasswordHandler } from '../handlers/auth/reset-password.js'
import { auth, admin, parseJson, loginRateLimit } from '../middleware.js'

export const authRoutes = [
  {
    method: 'POST',
    path: '/api/auth/login',
    middleware: [loginRateLimit, parseJson],
    handler: loginHandler,
  },
  {
    method: 'POST',
    path: '/api/auth/refresh',
    middleware: [auth],
    handler: refreshHandler,
  },
  {
    method: 'POST',
    path: '/api/auth/download-token',
    middleware: [auth],
    handler: downloadTokenHandler,
  },
  {
    method: 'POST',
    path: '/api/auth/change-password',
    middleware: [auth, parseJson],
    handler: changePasswordHandler,
  },
  {
    method: 'POST',
    path: '/api/auth/reset-password',
    middleware: [admin, parseJson],
    handler: resetPasswordHandler,
  },
]
