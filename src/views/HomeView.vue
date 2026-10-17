<script setup lang="ts">
import { onMounted, ref } from 'vue'
import logo from '../../midia/logo-krab-png.png'
import Icon from '../components/dashboard/DashboardIcon.vue'
import RecentMovements from '../components/dashboard/RecentMovements.vue'
import SideDrawer from '../components/dashboard/SideDrawer.vue'
import LancamentoForm from '../components/forms/LancamentoForm.vue'
import ContaForm from '../components/forms/ContaForm.vue'
import { obterDashboard, type Movimento } from '../services/dashboard'
import { mensagemErro } from '../services/http'
import { useAuthStore } from '../stores/auth'
import '../assets/dashboard.css'

type Cadastro = 'receita' | 'despesa' | 'banco'
const auth = useAuthStore()
const movimentos = ref<Movimento[]>([])
const carregando = ref(false)
const erro = ref('')
const cadastro = ref<Cadastro | null>(null)
const ocupado = ref(false)
const formulario = ref<{ alterado: boolean; enviando: boolean } | null>(null)
const atalhos = [
  { tipo: 'receita' as const, icone: 'mais', descricao: 'Registrar entrada, venda ou repasse' },
  { tipo: 'despesa' as const, icone: 'menos', descricao: 'Registrar saída, conta ou gasto' },
  { tipo: 'banco' as const, icone: 'banco', descricao: 'Adicionar conta, cartão ou instituição' },
]
// Apenas a lista de movimentações usa o retorno real. Os resumos, alertas e
// relatórios abaixo são demonstrações visuais até sua integração ser solicitada.
async function carregarDashboard() {
  if (carregando.value) return
  carregando.value = true
  erro.value = ''
  try {
    const resposta = await obterDashboard(auth.obterToken())
    movimentos.value = resposta.movimentacoes_recentes
  } catch (falha) {
    movimentos.value = []
    erro.value = mensagemErro(falha)
  } finally {
    carregando.value = false
  }
}

// Fechar não muda a rota. Impedimos fechamento durante o POST e confirmamos
// descarte quando existem campos preenchidos; erros preservam o formulário.
function fecharDrawer() {
  if (ocupado.value) return
  if (formulario.value?.alterado && !window.confirm('Descartar os dados preenchidos e fechar?'))
    return
  cadastro.value = null
}
onMounted(carregarDashboard)
</script>

<template>
  <div class="dashboard-shell">
    <div :inert="cadastro !== null">
      <header class="dashboard-header">
        <img :src="logo" alt="KRAB — Keep Resources Always Balanced" />
        <div class="header-tools">
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
        <section class="summary-grid" aria-label="Resumo financeiro de demonstração">
          <article class="panel balance">
            <p class="greeting">Olá, boas-vindas</p>
            <p class="muted">Saldo atual</p>
            <div class="balance-value"><sup>R$</sup> 2.000,00</div>
            <div class="balance-tags">
              <span>R$ 1.240,00 em receitas</span><span>R$ 760,00 em despesas</span>
            </div>
          </article>
          <article class="panel summary receita">
            <div class="summary-heading">
              <h3>Entradas</h3>
              <span class="icon-box solid"><Icon /></span>
            </div>
            <strong>R$ 1.240,00</strong>
            <p>3 receitas registradas nos últimos 30 dias</p>
          </article>
          <article class="panel summary despesa">
            <div class="summary-heading">
              <h3>Saídas</h3>
              <span class="icon-box solid"><Icon name="saida" /></span>
            </div>
            <strong>R$ 760,00</strong>
            <p>5 despesas registradas nos últimos 30 dias</p>
          </article>
        </section>
        <div class="dashboard-columns">
          <div class="column">
            <RecentMovements
              :itens="movimentos"
              :carregando="carregando"
              :erro="erro"
              :autenticado="Boolean(auth.accessToken)"
              @tentar="carregarDashboard"
            />
            <section class="panel alerts">
              <div class="section-heading">
                <div>
                  <h2>Alertas importantes</h2>
                  <p>Ações que precisam de atenção</p>
                </div>
                <span class="badge danger">2 pendências</span>
              </div>
              <div class="alert-row despesa">
                <span class="icon-box solid"><Icon name="alerta" /></span>
                <div>
                  <strong>Conta de água vence hoje</strong>
                  <p>Despesa agendada para pagamento</p>
                </div>
                <small>Hoje</small>
              </div>
              <div class="alert-row banco">
                <span class="icon-box solid"><Icon name="cartao" /></span>
                <div>
                  <strong>Cartão de crédito precisa ser atualizado</strong>
                  <p>Revise os dados do cartão principal</p>
                </div>
                <small>Amanhã</small>
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
              <button
                v-for="atalho in atalhos"
                :key="atalho.tipo"
                class="quick-action"
                :class="atalho.tipo"
                @click="cadastro = atalho.tipo"
              >
                <span class="icon-box solid"><Icon :name="atalho.icone" /></span
                ><span
                  ><strong>Cadastrar {{ atalho.tipo }}</strong
                  ><small>{{ atalho.descricao }}</small></span
                >
              </button>
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
                  <dd class="positive">R$ 1.240,00</dd>
                </div>
                <div>
                  <dt>Despesas do mês</dt>
                  <dd class="negative">R$ 760,00</dd>
                </div>
                <div>
                  <dt>Bancos cadastrados</dt>
                  <dd class="blue">2 contas</dd>
                </div>
                <div>
                  <dt>Próximo vencimento</dt>
                  <dd class="negative">Hoje</dd>
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
            <article class="report-card">
              <div>
                <span class="icon-box"><Icon name="documento" /></span>
                <h3>Extrato financeiro</h3>
              </div>
              <p>Veja entradas e saídas por período</p>
            </article>
            <article class="report-card receita">
              <div>
                <span class="icon-box solid"><Icon /></span>
                <h3>Relatório de receitas</h3>
              </div>
              <p>Acompanhe todas as entradas do negócio</p>
            </article>
            <article class="report-card despesa">
              <div>
                <span class="icon-box solid"><Icon name="saida" /></span>
                <h3>Relatório de despesas</h3>
              </div>
              <p>Visualize os gastos e saídas do período</p>
            </article>
          </div>
        </section>
        <p class="demo-note">
          Resumos, alertas e relatórios exibem dados de demonstração. As movimentações recentes são
          reais.
        </p>
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
          @salvo="carregarDashboard" /><LancamentoForm
          v-else
          ref="formulario"
          :tipo="cadastro"
          @ocupado="ocupado = $event"
          @salvo="carregarDashboard" /></SideDrawer
    ></Transition>
  </div>
</template>
