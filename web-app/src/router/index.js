import { createRouter, createWebHistory } from 'vue-router'
import { isLoggedIn } from '../api/pocketbase.js'

const routes = [
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
    path: '/templates',
    name: 'templates',
    component: () => import('../views/TemplatesView.vue'),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SettingsView.vue'),
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  if (!to.meta.public && !isLoggedIn()) {
    return { name: 'login' }
  }
})
