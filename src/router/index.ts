import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import LoginView from '../views/LoginView.vue'
import HomeView from '../views/HomeView.vue'
import CadastrosView from '../views/CadastrosView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),

  routes: [
    { path: '/receitas', component: CadastrosView },
    { path: '/contas', component: CadastrosView },
    { path: '/extrato', component: HomeView },
    { path: '/relatorios/receitas', component: HomeView },
    { path: '/relatorios/despesas', component: HomeView },
    { path: '/login', name: 'login', component: LoginView },
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/despesas',
      name: 'despesas',
      component: CadastrosView,
    },
  ],
})

// Executado após instalar o Pinia. A proteção local melhora a navegação;
// as rotas do backend ainda validam cada requisição independentemente.
router.beforeEach((to) => {
  if (to.path === '/login') return
  try {
    useAuthStore().obterToken()
  } catch {
    return '/login'
  }
})

export default router
