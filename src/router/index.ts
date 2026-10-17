import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import LoginView from '../views/LoginView.vue'
import HomeView from '../views/HomeView.vue'
import DespesasView from '../views/DespesasView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),

  routes: [
    { path: '/login', name: 'login', component: LoginView },
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/despesas',
      name: 'despesas',
      component: DespesasView,
    },
  ],
})

// Executado após instalar o Pinia. A proteção local melhora a navegação;
// as rotas do backend ainda validam cada requisição independentemente.
router.beforeEach((to) => {
  if (to.path !== '/despesas') return
  try {
    useAuthStore().obterToken()
  } catch {
    return '/login'
  }
})

export default router
