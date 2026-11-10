import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import LoginView from '../views/LoginView.vue'
import CadastroView from '../views/CadastroView.vue'
import NotFoundView from '../views/NotFoundView.vue'
import MovimentacoesView from '../views/MovimentacoesView.vue'
import AtividadesView from '../views/AtividadesView.vue'
import HomeView from '../views/HomeView.vue'
import CadastrosView from '../views/CadastrosView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),

  routes: [
    { path: '/cadastro', component: CadastroView, meta: { publica: true } },
    { path: '/movimentacoes', component: MovimentacoesView },
    { path: '/atividades', component: AtividadesView },
    { path: '/receitas', component: CadastrosView },
    { path: '/contas', component: CadastrosView },
    { path: '/extrato', component: HomeView },
    { path: '/relatorios/receitas', component: HomeView },
    { path: '/relatorios/despesas', component: HomeView },
    { path: '/login', name: 'login', component: LoginView, meta: { publica: true } },
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
    {
      path: '/:pathMatch(.*)*',
      name: 'nao-encontrada',
      component: NotFoundView,
      meta: { publica: true },
    },
  ],
})

// Executado após instalar o Pinia. A proteção local melhora a navegação;
// as rotas do backend ainda validam cada requisição independentemente.
router.beforeEach((to) => {
  const publica = to.path === '/login' || to.path === '/cadastro'
  let autenticado = false
  try {
    useAuthStore().obterToken()
    autenticado = true
  } catch {
    /* A store invalida tokens vencidos. */
  }
  if (to.name === 'nao-encontrada') return
  if (publica) return autenticado ? '/' : undefined
  if (!autenticado) return '/login'
  // Relatório e cadastro são modos exclusivos, inclusive para URLs digitadas à mão.
  if ((to.path === '/extrato' || to.path.startsWith('/relatorios/')) && to.query.cadastro) {
    const query = { ...to.query }
    delete query.cadastro
    return { path: to.path, query, replace: true }
  }
})

router.afterEach((to) => {
  const titulo =
    to.name === 'nao-encontrada'
      ? 'Página não encontrada'
      : to.path === '/login'
        ? 'Entrar'
        : to.path === '/cadastro'
          ? to.query.confirmacao === '1'
            ? 'Confirmar e-mail'
            : 'Criar conta'
          : ''
  document.title = titulo ? `${titulo} | KRAB` : 'KRAB'
})

export default router
