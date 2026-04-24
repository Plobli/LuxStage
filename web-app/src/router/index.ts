import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { isLoggedIn, getToken } from '../api/client'
import { jwtDecode } from '../api/jwtDecode.js'

function isAdmin(): boolean {
  try {
    const token = getToken()
    return token ? jwtDecode(token)?.role === 'admin' : false
  } catch { return false }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    name: 'shows',
    component: () => import('../views/ShowsView.vue'),
  },
  {
    path: '/shows/:id',
    name: 'show-detail',
    component: () => import('../views/ShowDetailView.vue'),
    props: true,
  },
  {
    path: '/archive',
    name: 'archive',
    component: () => import('../views/ArchiveView.vue'),
  },
  {
    path: '/templates',
    name: 'templates',
    component: () => import('../views/TemplatesView.vue'),
  },
  {
    path: '/settings',
    component: () => import('../views/SettingsView.vue'),
    children: [
      { path: '', redirect: '/settings/account' },
      { path: 'account', name: 'settings-account', component: () => import('../views/settings/AccountView.vue') },
      { path: 'display', name: 'settings-display', component: () => import('../views/settings/DisplayView.vue') },
      { path: 'server', name: 'settings-server', component: () => import('../views/settings/ServerView.vue'), meta: { adminOnly: true } },
      { path: 'backup', name: 'settings-backup', component: () => import('../views/settings/BackupView.vue') },
      { path: 'users', name: 'settings-users', component: () => import('../views/settings/UsersView.vue'), meta: { adminOnly: true } },
      { path: 'smtp', name: 'settings-smtp', component: () => import('../views/settings/SmtpView.vue'), meta: { adminOnly: true } },
      { path: 'update', name: 'settings-update', component: () => import('../views/settings/UpdateView.vue'), meta: { adminOnly: true } },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFoundView.vue'),
    meta: { public: true },
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  if (!to.meta.public && !isLoggedIn()) return { name: 'login' }
  if (to.meta.adminOnly && !isAdmin()) return { name: 'settings-account' }
})

