<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import logo from '../../midia/logo-krab-png.png'
import Icon from '../components/dashboard/DashboardIcon.vue'
import RecentActivities from '../components/dashboard/RecentActivities.vue'
import SideDrawer from '../components/dashboard/SideDrawer.vue'
import LancamentoForm from '../components/forms/LancamentoForm.vue'
import RelatoriosView from './RelatoriosView.vue'
import PerfilForm from '../components/forms/PerfilForm.vue'
import ContaForm from '../components/forms/ContaForm.vue'
import { obterDashboard, moeda, dataFinanceira, type Dashboard } from '../services/dashboard'
import { mensagemErro } from '../services/http'
import { useAuthStore } from '../stores/auth'
import { obterPerfil } from '../services/perfil'
import { todasContas, obterConta, type Conta } from '../services/contas'
import { obterRelatorio, type Relatorio } from '../services/relatorios'
import { useNotificacoesStore } from '../stores/notificacoes'
import '../assets/dashboard.css'
import '../assets/home.css'
import '../assets/header.css'
import ConfiguracoesPanel from '../components/dashboard/ConfiguracoesPanel.vue'
import { usePreferenciasStore } from '../stores/preferencias'
import { useTemaStore } from '../stores/tema'
const tema = useTemaStore()
const preferencias = usePreferenciasStore()
const configuracoesAberto = ref(false)

type Cadastro = 'receita' | 'despesa' | 'banco'
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const notificacoes = useNotificacoesStore()
const contas = ref<Conta[]>([])
const versaoMovimentos = ref(0)
const erroContas = ref('')
const carregandoContas = ref(true)
const hubRelatorios = ref(false)
const contaId = computed(() =>
  typeof route.query.conta_home === 'string' ? route.query.conta_home : '',
)
const contaSelecionada = computed(() => contas.value.find((conta) => conta.id === contaId.value))
const contextoQuery = computed<Record<string, string>>(() =>
  contaId.value ? { conta_home: contaId.value } : ({} as Record<string, string>),
)
const contexto = ref<{
  saldo: number
  receitas: Relatorio
  despesas: Relatorio
} | null>(null)
const carregandoContexto = ref(false)
const erroContexto = ref('')
let sequenciaContexto = 0
async function carregarContas() {
  carregandoContas.value = true
  erroContas.value = ''
  try {
    contas.value = await todasContas(auth.obterToken())
  } catch (falha) {
    erroContas.value = mensagemErro(falha)
  } finally {
    carregandoContas.value = false
  }
}
async function carregarContexto() {
  const sequencia = ++sequenciaContexto
  contexto.value = null
  erroContexto.value = ''
  carregandoContexto.value = Boolean(contaId.value)
  if (!contaId.value) return
  const id = contaId.value
  try {
    const token = auth.obterToken()
    const filtro = new URLSearchParams({ conta_id: id })
    // O backend define o período padrão de 30 dias e consolida todos os totais.
    const [conta, receitas, despesas] = await Promise.all([
      obterConta(id, token),
      obterRelatorio('receitas', filtro, token),
      obterRelatorio('despesas', filtro, token),
    ])
    if (sequencia === sequenciaContexto)
      contexto.value = { saldo: conta.saldo_disponivel, receitas, despesas }
  } catch (falha) {
    if (sequencia === sequenciaContexto) erroContexto.value = mensagemErro(falha)
  } finally {
    if (sequencia === sequenciaContexto) carregandoContexto.value = false
  }
}
watch(contaId, carregarContexto, { immediate: true })
const carregandoFinanceiro = computed(() =>
  contaId.value ? carregandoContexto.value : carregandoResumo.value,
)
const erroFinanceiro = computed(() => (contaId.value ? erroContexto.value : erroResumo.value))
const dadosFinanceiros = computed(() =>
  contaId.value
    ? contexto.value
      ? {
          saldo_total: contexto.value.saldo,
          entradas_30d: contexto.value.receitas,
          saidas_30d: contexto.value.despesas,
        }
      : null
    : resumo.value,
)
function tentarFinanceiro() {
  if (contaId.value) void carregarContexto()
  else void carregarResumo()
}
function selecionarConta(event: Event) {
  void router.replace({
    query: { ...route.query, conta_home: (event.target as HTMLSelectElement).value || undefined },
  })
}
const cadastro = ref<Cadastro | null>(null)
const perfilAberto = ref(false)
const nomeUsuario = ref('')
async function carregarNome() {
  try {
    nomeUsuario.value = (await obterPerfil(auth.obterToken())).nome ?? ''
  } catch {
    nomeUsuario.value = ''
  }
}
const salvandoPerfil = ref(false)
const formularioPerfil = ref<{ alterado: boolean } | null>(null)
function fecharPerfil() {
  if (salvandoPerfil.value) return
  if (
    formularioPerfil.value?.alterado &&
    !window.confirm('Descartar as alterações do perfil e fechar?')
  )
    return
  perfilAberto.value = false
  void carregarNome()
}
const tituloRelatorio = computed(() =>
  route.path === '/extrato'
    ? 'Extrato financeiro'
    : route.path === '/relatorios/receitas'
      ? 'Relatório de receitas'
      : route.path === '/relatorios/despesas'
        ? 'Relatório de despesas'
        : null,
)
function fecharRelatorio() {
  void router.push({ path: '/', query: contextoQuery.value })
}
watch(
  () => route.query.cadastro,
  (valor) => {
    if (valor) {
      perfilAberto.value = false
      hubRelatorios.value = false
    }
    cadastro.value =
      !tituloRelatorio.value && (valor === 'receita' || valor === 'despesa' || valor === 'banco')
        ? valor
        : null
  },
  { immediate: true },
)
watch(
  () => route.path,
  () => {
    perfilAberto.value = false
    hubRelatorios.value = false
  },
)
const drawerAberto = computed(() =>
  Boolean(
    cadastro.value ||
    tituloRelatorio.value ||
    perfilAberto.value ||
    hubRelatorios.value ||
    configuracoesAberto.value,
  ),
)
const tituloDrawer = computed(
  () =>
    (configuracoesAberto.value ? 'Configurações' : null) ??
    tituloRelatorio.value ??
    (cadastro.value
      ? `Cadastrar ${cadastro.value === 'banco' ? 'conta ou caixa' : cadastro.value}`
      : hubRelatorios.value
        ? 'Relatórios'
        : 'Meu perfil'),
)
const ocupadoDrawer = computed(() =>
  perfilAberto.value ? salvandoPerfil.value : cadastro.value ? ocupado.value : false,
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
    notificacoes.adicionar({
      tipo: 'erro',
      titulo: 'Não foi possível atualizar a Home',
      mensagem: erroResumo.value,
      grupo: 'home',
    })
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
  if (carregandoFinanceiro.value) return 'Carregando…'
  if (!dadosFinanceiros.value) return 'Indisponível'
  return moeda(
    campo === 'saldo'
      ? dadosFinanceiros.value.saldo_total
      : campo === 'entradas'
        ? dadosFinanceiros.value.entradas_30d.total
        : dadosFinanceiros.value.saidas_30d.total,
  )
}
function sair() {
  perfilAberto.value = false
  auth.invalidarToken()
  void router.push('/login')
}
function aposSalvarLancamento() {
  versaoMovimentos.value++
  void carregarContas()
  void carregarContexto()
  notificacoes.adicionar({
    tipo: 'sucesso',
    titulo: 'Cadastro realizado',
    mensagem:
      cadastro.value === 'banco'
        ? 'Sua conta ou caixa já está disponível.'
        : cadastro.value === 'receita'
          ? 'Receita registrada. O resumo será atualizado.'
          : 'Despesa registrada. O saldo considera apenas despesas pagas.',
    grupo: 'cadastro-home',
  })
  void carregarResumo()
}
// Fechar não muda a rota. Impedimos fechamento durante o POST e confirmamos
// descarte quando existem campos preenchidos; erros preservam o formulário.
function fecharDrawer() {
  if (ocupado.value) return
  if (formulario.value?.alterado && !window.confirm('Descartar os dados preenchidos e fechar?'))
    return
  void router.replace({ query: contextoQuery.value })
}
onMounted(() => {
  void carregarResumo()
  void carregarNome()
  void carregarContas()
})
</script>

<template>
  <div class="dashboard-shell home-dashboard">
    <div :inert="drawerAberto">
      <header class="dashboard-header">
        <img :src="logo" alt="KRAB — Keep Resources Always Balanced" />
        <div class="header-tools">
          <div class="header-control">
            <button
              type="button"
              class="header-action"
              :aria-label="tema.acao"
              aria-describedby="tooltip-tema"
              @click="tema.alternar"
            >
              <Icon
                :key="tema.atual"
                :name="tema.atual === 'dark' ? 'sol' : 'lua'"
                class="theme-icon"
              />
            </button>
            <span id="tooltip-tema" class="header-tooltip" role="tooltip">{{ tema.acao }}</span>
          </div>
          <div class="header-control">
            <button
              type="button"
              class="header-action"
              aria-label="Configurações"
              aria-describedby="tooltip-config"
              aria-haspopup="dialog"
              :aria-expanded="configuracoesAberto"
              @click="configuracoesAberto = true"
            >
              <Icon name="config" />
            </button>
            <span id="tooltip-config" class="header-tooltip" role="tooltip">Configurações</span>
          </div>
          <div class="header-control">
            <button
              type="button"
              class="header-action"
              aria-label="Meu perfil"
              aria-describedby="tooltip-perfil"
              aria-haspopup="dialog"
              :aria-expanded="perfilAberto"
              @click="perfilAberto = true"
            >
              <Icon name="perfil" />
            </button>
            <span id="tooltip-perfil" class="header-tooltip" role="tooltip">Meu perfil</span>
          </div>
        </div>
      </header>
      <main class="dashboard-main home-main">
        <div class="home-intro">
          <div>
            <p class="home-eyebrow">Seu dia financeiro, mais simples</p>
            <h1>{{ nomeUsuario ? `Olá, ${nomeUsuario}` : 'Olá, boas-vindas' }}</h1>
            <p>Registre, acompanhe e cuide do seu dinheiro.</p>
          </div>
          <section
            v-if="preferencias.visualizacao.atalhos"
            class="home-shortcuts"
            aria-labelledby="home-shortcuts-title"
          >
            <h2 id="home-shortcuts-title">Atalhos principais</h2>
            <div>
              <RouterLink
                v-for="atalho in atalhos"
                :key="atalho.tipo"
                :to="{ path: '/', query: { ...contextoQuery, cadastro: atalho.tipo } }"
                :class="atalho.tipo"
                aria-haspopup="dialog"
                ><Icon :name="atalho.icone" />{{
                  atalho.tipo === 'banco' ? 'Nova conta ou caixa' : `Nova ${atalho.tipo}`
                }}</RouterLink
              >
            </div>
          </section>
        </div>
        <div class="home-context-row">
          <nav class="report-navigation home-navigation" aria-label="Consultas da Home">
            <RouterLink to="/receitas"><Icon name="entrada" />Receitas</RouterLink>
            <RouterLink to="/despesas"><Icon name="saida" />Despesas</RouterLink>
            <RouterLink to="/contas"><Icon name="banco" />Contas e caixas</RouterLink>
          </nav>
          <div class="home-account-selector">
            <label for="home-account">Selecione a conta/caixa</label>
            <select id="home-account" :value="contaId" @change="selecionarConta">
              <option value="">Todas as contas/caixas</option>
              <option v-if="contaId && !contaSelecionada" :value="contaId">
                Conta selecionada
              </option>
              <option v-for="conta in contas" :key="conta.id" :value="conta.id">
                {{ conta.nome }}
              </option>
            </select>
            <small v-if="carregandoContas" role="status">Carregando contas…</small>
            <div v-else-if="erroContas" role="alert">
              {{ erroContas }}
              <button class="retry" @click="carregarContas">Tentar novamente</button>
            </div>
          </div>
        </div>
        <p class="home-context-caption" aria-live="polite">
          Visualizando:
          {{ contaId ? (contaSelecionada?.nome ?? 'conta selecionada') : 'todas as contas/caixas' }}
        </p>
        <section
          class="summary-grid"
          aria-label="Resumo financeiro"
          :aria-busy="carregandoFinanceiro"
        >
          <article class="panel balance">
            <p class="muted">Saldo atual</p>
            <div
              class="balance-value"
              :class="{ 'summary-feedback': carregandoFinanceiro || !dadosFinanceiros }"
            >
              {{ exibirTotal('saldo') }}
            </div>
            <p class="muted">
              {{
                contaId
                  ? 'Saldo disponível nesta conta/caixa'
                  : 'Saldo disponível nas contas ativas'
              }}
            </p>
          </article>
          <article class="panel summary receita">
            <div class="summary-heading">
              <h3>Entradas</h3>
              <span class="icon-box solid"><Icon /></span>
            </div>
            <strong :class="{ 'summary-feedback': carregandoFinanceiro || !dadosFinanceiros }">{{
              exibirTotal('entradas')
            }}</strong>
            <p>
              {{
                dadosFinanceiros && !carregandoFinanceiro
                  ? dadosFinanceiros.entradas_30d.quantidade
                  : '—'
              }}
              receitas nos últimos 30 dias
            </p>
          </article>
          <article class="panel summary despesa">
            <div class="summary-heading">
              <h3>Saídas</h3>
              <span class="icon-box solid"><Icon name="saida" /></span>
            </div>
            <strong :class="{ 'summary-feedback': carregandoFinanceiro || !dadosFinanceiros }">{{
              exibirTotal('saidas')
            }}</strong>
            <p>
              {{
                dadosFinanceiros && !carregandoFinanceiro
                  ? dadosFinanceiros.saidas_30d.quantidade
                  : '—'
              }}
              despesas pagas nos últimos 30 dias
            </p>
          </article>
        </section>
        <div v-if="erroFinanceiro" class="summary-error" role="alert">
          <p>Não foi possível atualizar os totais. {{ erroFinanceiro }}</p>
          <button v-if="auth.accessToken" class="retry" @click="tentarFinanceiro">
            Tentar novamente
          </button>
          <RouterLink v-else to="/login">Entrar novamente</RouterLink>
        </div>
        <div
          class="home-content-grid"
          :class="{
            'custom-visibility':
              !preferencias.visualizacao.alertas ||
              !preferencias.visualizacao.resumo ||
              !preferencias.visualizacao.atividades,
          }"
        >
          <section
            v-if="preferencias.visualizacao.alertas"
            class="panel alerts home-alerts"
            :aria-busy="carregandoResumo"
          >
            <div class="section-heading">
              <div>
                <h2>Alertas importantes</h2>
                <p v-if="contaId" class="home-general-note">Visão geral · todas as contas/caixas</p>
                <p>Despesas vencidas ou com vencimento em até sete dias</p>
              </div>
            </div>
            <p v-if="carregandoResumo" role="status">Carregando alertas…</p>
            <p v-else-if="!resumo">Alertas indisponíveis.</p>
            <p v-else-if="!resumo.alertas.length">Nenhuma despesa precisa de atenção agora.</p>
            <div
              v-if="resumo?.alertas.length && !carregandoResumo"
              class="home-alert-list"
              tabindex="0"
              aria-label="Alertas de despesas — lista rolável"
            >
              <div
                v-for="alerta in resumo?.alertas ?? []"
                v-show="!carregandoResumo"
                :key="alerta.id"
                class="alert-row"
                :class="`alert-${alerta.situacao}`"
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
            </div>
            <RouterLink to="/despesas" class="home-section-link"
              >Consultar todas as despesas <span aria-hidden="true">→</span></RouterLink
            >
          </section>
          <section v-if="preferencias.visualizacao.resumo" class="panel quick-summary">
            <div class="section-heading">
              <div>
                <h2>Resumo rápido</h2>
                <p v-if="contaId" class="home-general-note">
                  Visão geral · todas as contas/caixas, sem filtro
                </p>
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
                <dt>Despesas pagas do mês</dt>
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
                <dt>Contas e caixas</dt>
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
          <RecentActivities
            v-if="preferencias.visualizacao.atividades"
            :conta-selecionada="Boolean(contaId)"
            :versao="versaoMovimentos"
          />
        </div>
      </main>
      <nav
        v-if="!drawerAberto && preferencias.visualizacao.menuFlutuante"
        class="home-action-dock"
        aria-label="Cadastrar lançamento ou conta"
      >
        <RouterLink
          v-for="atalho in atalhos"
          :key="atalho.tipo"
          :to="{ path: '/', query: { ...contextoQuery, cadastro: atalho.tipo } }"
          :class="atalho.tipo"
          :aria-label="`Cadastrar ${atalho.tipo === 'banco' ? 'conta ou caixa' : atalho.tipo}`"
          aria-haspopup="dialog"
        >
          <Icon :name="atalho.icone" /><span class="dock-label"
            >Cadastrar {{ atalho.tipo === 'banco' ? 'conta ou caixa' : atalho.tipo }}</span
          ><span class="dock-mobile-label">{{
            atalho.tipo === 'banco'
              ? 'Conta ou caixa'
              : atalho.tipo === 'receita'
                ? 'Receita'
                : 'Despesa'
          }}</span>
        </RouterLink>
        <button
          type="button"
          class="dock-reports"
          aria-label="Relatórios"
          aria-haspopup="dialog"
          @click="hubRelatorios = true"
        >
          <Icon name="documento" /><span class="dock-label">Relatórios</span
          ><span class="dock-mobile-label">Relatórios</span>
        </button>
      </nav>
    </div>
    <SideDrawer
      v-if="drawerAberto"
      :titulo="tituloDrawer"
      :ocupado="ocupadoDrawer"
      :class="tituloRelatorio ? 'report-drawer' : (cadastro ?? '')"
      :subtitulo="
        configuracoesAberto
          ? 'Personalize sua experiência no KRAB'
          : tituloRelatorio
            ? 'Relatórios'
            : perfilAberto
              ? 'Sua conta'
              : 'Novo cadastro'
      "
      @fechar="
        configuracoesAberto
          ? (configuracoesAberto = false)
          : hubRelatorios
            ? (hubRelatorios = false)
            : perfilAberto
              ? fecharPerfil()
              : tituloRelatorio
                ? fecharRelatorio()
                : fecharDrawer()
      "
    >
      <ConfiguracoesPanel v-if="configuracoesAberto" />
      <template v-else-if="hubRelatorios">
        <section class="home-report-hub">
          <div class="section-heading">
            <div>
              <h2>Relatórios</h2>
              <p>Acesse os relatórios principais do sistema</p>
            </div>
          </div>
          <div class="home-report-hub-list">
            <RouterLink :to="{ path: '/extrato', query: contextoQuery }" class="report-card">
              <div>
                <span class="icon-box"><Icon name="documento" /></span>
                <h3>Extrato financeiro</h3>
              </div>
              <p>Veja entradas e saídas por período</p>
            </RouterLink>
            <RouterLink
              :to="{ path: '/relatorios/receitas', query: contextoQuery }"
              class="report-card receita"
            >
              <div>
                <span class="icon-box solid"><Icon /></span>
                <h3>Relatório de receitas</h3>
              </div>
              <p>Acompanhe suas entradas</p>
            </RouterLink>
            <RouterLink
              :to="{ path: '/relatorios/despesas', query: contextoQuery }"
              class="report-card despesa"
            >
              <div>
                <span class="icon-box solid"><Icon name="saida" /></span>
                <h3>Relatório de despesas</h3>
              </div>
              <p>Analise seus gastos</p>
            </RouterLink>
          </div>
        </section>
      </template>
      <PerfilForm
        v-else-if="perfilAberto"
        ref="formularioPerfil"
        @ocupado="salvandoPerfil = $event"
        @salvo="carregarNome"
        @sair="sair"
      />
      <RelatoriosView v-else-if="tituloRelatorio" :key="route.path" />
      <ContaForm
        v-else-if="cadastro === 'banco'"
        ref="formulario"
        @ocupado="ocupado = $event"
        @salvo="aposSalvarLancamento"
      />
      <LancamentoForm
        v-else-if="cadastro"
        :key="cadastro"
        ref="formulario"
        :tipo="cadastro"
        @ocupado="ocupado = $event"
        @salvo="aposSalvarLancamento"
      />
    </SideDrawer>
  </div>
</template>
