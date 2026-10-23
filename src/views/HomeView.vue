<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import logo from '../../midia/logo-krab-png.png'
import Icon from '../components/dashboard/DashboardIcon.vue'
import RecentActivities from '../components/dashboard/RecentActivities.vue'
import SideDrawer from '../components/dashboard/SideDrawer.vue'
import LancamentoForm from '../components/forms/LancamentoForm.vue'
import ContaForm from '../components/forms/ContaForm.vue'
import { obterDashboard, moeda, dataFinanceira, type Dashboard } from '../services/dashboard'
import { mensagemErro } from '../services/http'
import { useAuthStore } from '../stores/auth'
import '../assets/dashboard.css'

type Cadastro = 'receita' | 'despesa' | 'banco'
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const cadastro = ref<Cadastro | null>(null)
watch(
  () => route.query.cadastro,
  (valor) => {
    cadastro.value = valor === 'receita' || valor === 'despesa' || valor === 'banco' ? valor : null
  },
  { immediate: true },
)
const ocupado = ref(false)
const formulario = ref<{ alterado: boolean; enviando: boolean } | null>(null)
const atalhos = [
  { tipo: 'receita' as const, icone: 'mais', descricao: 'Registrar entrada, venda ou repasse' },
  { tipo: 'despesa' as const, icone: 'menos', descricao: 'Registrar saída, conta ou gasto' },
  { tipo: 'banco' as const, icone: 'banco', descricao: 'Adicionar conta bancária ou caixa' },
]
const resumo = ref<Dashboard | null>(null)
const carregandoResumo = ref(true)
const erroResumo = ref('')
let atualizarNovamente = false
async function carregarResumo() {
  if (ocupandoLeitura) {
    atualizarNovamente = true
    return
  }
  ocupandoLeitura = true
  carregandoResumo.value = true
  erroResumo.value = ''
  try {
    resumo.value = await obterDashboard(auth.obterToken())
  } catch (falha) {
    resumo.value = null
    erroResumo.value = mensagemErro(falha)
  } finally {
    ocupandoLeitura = false
    carregandoResumo.value = false
    if (atualizarNovamente) {
      atualizarNovamente = false
      void carregarResumo()
    }
  }
}
let ocupandoLeitura = false
function exibirTotal(campo: 'saldo' | 'entradas' | 'saidas'): string {
  if (carregandoResumo.value) return 'Carregando…'
  if (!resumo.value) return 'Indisponível'
  return moeda(
    campo === 'saldo'
      ? resumo.value.saldo_total
      : campo === 'entradas'
        ? resumo.value.entradas_30d.total
        : resumo.value.saidas_30d.total,
  )
}
function sair() {
  auth.invalidarToken()
  void router.push('/login')
}
function aposSalvarLancamento() {
  void carregarResumo()
}
// Fechar não muda a rota. Impedimos fechamento durante o POST e confirmamos
// descarte quando existem campos preenchidos; erros preservam o formulário.
function fecharDrawer() {
  if (ocupado.value) return
  if (formulario.value?.alterado && !window.confirm('Descartar os dados preenchidos e fechar?'))
    return
  void router.replace({ query: {} })
}
onMounted(() => {
  void carregarResumo()
})
</script>

<template>
  <div class="dashboard-shell">
    <div :inert="cadastro !== null">
      <header class="dashboard-header">
        <img :src="logo" alt="KRAB — Keep Resources Always Balanced" />
        <div class="header-tools">
          <button class="retry" @click="sair">Sair</button>
          <span
            v-for="item in [
              { nome: 'sol', titulo: 'Tema' },
              { nome: 'config', titulo: 'Configurações' },
              { nome: 'perfil', titulo: 'Perfil' },
            ]"
            :key="item.nome"
            :title="`${item.titulo} — em breve`"
            role="img"
            :aria-label="`${item.titulo} — em breve`"
            ><Icon :name="item.nome"
          /></span>
        </div>
      </header>
      <main class="dashboard-main">
        <nav class="report-navigation">
          <RouterLink to="/receitas">Receitas</RouterLink
          ><RouterLink to="/despesas">Despesas</RouterLink
          ><RouterLink to="/contas">Contas e caixas</RouterLink>
        </nav>
        <section class="summary-grid" aria-label="Resumo financeiro" :aria-busy="carregandoResumo">
          <article class="panel balance">
            <p class="greeting">Olá, boas-vindas</p>
            <p class="muted">Saldo atual</p>
            <div class="balance-value" :class="{ 'summary-feedback': carregandoResumo || !resumo }">
              {{ exibirTotal('saldo') }}
            </div>
            <p class="muted">Saldo disponível nas contas ativas</p>
            <div v-if="resumo && !carregandoResumo" class="balance-tags">
              <span>{{ moeda(resumo.entradas_30d.total) }} em receitas</span
              ><span>{{ moeda(resumo.saidas_30d.total) }} em despesas</span>
            </div>
          </article>
          <article class="panel summary receita">
            <div class="summary-heading">
              <h3>Entradas</h3>
              <span class="icon-box solid"><Icon /></span>
            </div>
            <strong :class="{ 'summary-feedback': carregandoResumo || !resumo }">{{
              exibirTotal('entradas')
            }}</strong>
            <p>
              {{ resumo && !carregandoResumo ? resumo.entradas_30d.quantidade : '—' }} receitas nos
              últimos 30 dias
            </p>
          </article>
          <article class="panel summary despesa">
            <div class="summary-heading">
              <h3>Saídas</h3>
              <span class="icon-box solid"><Icon name="saida" /></span>
            </div>
            <strong :class="{ 'summary-feedback': carregandoResumo || !resumo }">{{
              exibirTotal('saidas')
            }}</strong>
            <p>
              {{ resumo && !carregandoResumo ? resumo.saidas_30d.quantidade : '—' }} despesas pagas
              nos últimos 30 dias
            </p>
          </article>
        </section>
        <div v-if="erroResumo" class="summary-error" role="alert">
          <p>Não foi possível atualizar os totais. {{ erroResumo }}</p>
          <button v-if="auth.accessToken" class="retry" @click="carregarResumo">
            Tentar novamente
          </button>
          <RouterLink v-else to="/login">Entrar novamente</RouterLink>
        </div>
        <div class="dashboard-columns">
          <div class="column">
            <RecentActivities
              :itens="resumo?.movimentacoes_recentes ?? []"
              :carregando="carregandoResumo"
              :erro="erroResumo"
              :autenticado="Boolean(auth.accessToken)"
              @tentar="carregarResumo"
            />
            <section class="panel alerts" :aria-busy="carregandoResumo">
              <div class="section-heading">
                <div>
                  <h2>Alertas importantes</h2>
                  <p>Despesas vencidas ou com vencimento em até sete dias</p>
                </div>
              </div>
              <p v-if="carregandoResumo" role="status">Carregando alertas…</p>
              <p v-else-if="!resumo">Alertas indisponíveis.</p>
              <p v-else-if="!resumo.alertas.length">Nenhuma despesa precisa de atenção agora.</p>
              <div
                v-for="alerta in resumo?.alertas ?? []"
                v-show="!carregandoResumo"
                :key="alerta.id"
                class="alert-row despesa"
              >
                <span class="icon-box solid"><Icon name="alerta" /></span>
                <div>
                  <strong>{{ alerta.descricao }}</strong>
                  <p>{{ moeda(alerta.valor) }} • {{ dataFinanceira(alerta.data_vencimento) }}</p>
                </div>
                <small>{{
                  alerta.situacao === 'vencida'
                    ? 'Vencida'
                    : alerta.situacao === 'hoje'
                      ? 'Vence hoje'
                      : 'Em breve'
                }}</small>
              </div>
            </section>
          </div>
          <div class="column">
            <section class="panel quick-actions">
              <div class="section-heading">
                <div>
                  <h2>Atalhos principais</h2>
                  <p>Ações rápidas para o seu dia a dia</p>
                </div>
              </div>
              <RouterLink
                v-for="atalho in atalhos"
                :key="atalho.tipo"
                class="quick-action"
                :class="atalho.tipo"
                :to="{ query: { cadastro: atalho.tipo } }"
              >
                <span class="icon-box solid"><Icon :name="atalho.icone" /></span
                ><span
                  ><strong>Cadastrar {{ atalho.tipo }}</strong
                  ><small>{{ atalho.descricao }}</small></span
                >
              </RouterLink>
            </section>
            <section class="panel quick-summary">
              <div class="section-heading">
                <div>
                  <h2>Resumo rápido</h2>
                  <p>Visão geral do seu fluxo</p>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Receitas do mês</dt>
                  <dd class="positive">
                    {{
                      carregandoResumo
                        ? 'Carregando…'
                        : resumo
                          ? moeda(resumo.mes.receitas)
                          : 'Indisponível'
                    }}
                  </dd>
                </div>
                <div>
                  <dt>Despesas do mês</dt>
                  <dd class="negative">
                    {{
                      carregandoResumo
                        ? 'Carregando…'
                        : resumo
                          ? moeda(resumo.mes.despesas)
                          : 'Indisponível'
                    }}
                  </dd>
                </div>
                <div>
                  <dt>Bancos cadastrados</dt>
                  <dd class="blue">
                    {{
                      carregandoResumo
                        ? 'Carregando…'
                        : resumo
                          ? `${resumo.contas_ativas} contas`
                          : 'Indisponível'
                    }}
                  </dd>
                </div>
                <div>
                  <dt>Próximo vencimento</dt>
                  <dd class="negative">
                    {{
                      carregandoResumo
                        ? 'Carregando…'
                        : !resumo
                          ? 'Indisponível'
                          : resumo.proximo_vencimento
                            ? dataFinanceira(resumo.proximo_vencimento.data_vencimento)
                            : 'Nenhum previsto'
                    }}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
        <section class="panel reports">
          <div class="section-heading">
            <div>
              <h2>Relatórios</h2>
              <p>Acesse os relatórios principais do sistema</p>
            </div>
          </div>
          <div class="reports-grid">
            <RouterLink to="/extrato" class="report-card">
              <div>
                <span class="icon-box"><Icon name="documento" /></span>
                <h3>Extrato financeiro</h3>
              </div>
              <p>Veja entradas e saídas por período</p>
            </RouterLink>
            <RouterLink to="/relatorios/receitas" class="report-card receita">
              <div>
                <span class="icon-box solid"><Icon /></span>
                <h3>Relatório de receitas</h3>
              </div>
              <p>Acompanhe todas as entradas do negócio</p>
            </RouterLink>
            <RouterLink to="/relatorios/despesas" class="report-card despesa">
              <div>
                <span class="icon-box solid"><Icon name="saida" /></span>
                <h3>Relatório de despesas</h3>
              </div>
              <p>Visualize os gastos e saídas do período</p>
            </RouterLink>
          </div>
        </section>
      </main>
    </div>
    <Transition name="drawer"
      ><SideDrawer
        v-if="cadastro"
        :titulo="`Cadastrar ${cadastro}`"
        :ocupado="ocupado"
        :class="cadastro"
        @fechar="fecharDrawer"
        ><ContaForm
          v-if="cadastro === 'banco'"
          ref="formulario"
          @ocupado="ocupado = $event"
          @salvo="aposSalvarLancamento" /><LancamentoForm
          v-else
          ref="formulario"
          :tipo="cadastro"
          @ocupado="ocupado = $event"
          @salvo="aposSalvarLancamento" /></SideDrawer
    ></Transition>
  </div>
</template>
