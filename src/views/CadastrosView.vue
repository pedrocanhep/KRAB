<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import LancamentoForm from '../components/forms/LancamentoForm.vue'
import ContaForm from '../components/forms/ContaForm.vue'
import PagamentoForm from '../components/forms/PagamentoForm.vue'
import SideDrawer from '../components/dashboard/SideDrawer.vue'
import RegistroDetalhe from '../components/consultas/RegistroDetalhe.vue'
import Icon from '../components/dashboard/DashboardIcon.vue'
import {
  abrirImpressao,
  imprimirDocumento,
  consultarListagemCompleta,
  documentoListagem,
} from '../services/exportacao-relatorio'
import { useNotificacoesStore } from '../stores/notificacoes'
import {
  listarContas,
  todasContas,
  excluirConta,
  restaurarConta,
  nomesTipoConta,
  type Conta,
} from '../services/contas'
import {
  listarReceitas,
  excluirReceita,
  restaurarReceita,
  type Receita,
} from '../services/receitas'
import {
  listarDespesas,
  excluirDespesa,
  restaurarDespesa,
  type Despesa,
  type ResultadoDespesa,
} from '../services/despesas'
import { moeda, dataFinanceira } from '../services/dashboard'
import { mensagemErro } from '../services/http'
import { useAuthStore } from '../stores/auth'
import '../assets/dashboard.css'
import '../assets/forms.css'
import '../assets/secondary.css'

const route = useRoute()
const auth = useAuthStore()
const notificacoes = useNotificacoesStore()
const exportando = ref(false)
const erroExportacao = ref('')
async function exportar() {
  if (exportando.value || carregando.value || ocupado.value || erro.value) return
  const dominio = tipo.value
  const filtrosExportados = new URLSearchParams(aplicados)
  const contasExportadas = new Map(contas.value.map((c) => [c.id, c.nome]))
  const nomeDaConta = (id: string) => contasExportadas.get(id) ?? id
  const titulo =
    dominio === 'conta' ? 'Contas e caixas' : dominio === 'receita' ? 'Receitas' : 'Despesas'
  const nome = `krab-${dominio === 'conta' ? 'contas' : dominio === 'receita' ? 'receitas' : 'despesas'}-${new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })}`
  const metadados: [string, string][] = [
    [
      'Situação',
      filtrosExportados.get('situacao') === 'ativas'
        ? 'Ativos'
        : filtrosExportados.get('situacao') === 'excluidas'
          ? 'Excluídos'
          : 'Todos',
    ],
  ]
  if (dominio === 'conta') {
    const codigo = filtrosExportados.get('tipo')
    metadados.push(['Tipo', codigo ? (nomesTipoConta[codigo as Conta['tipo']] ?? codigo) : 'Todos'])
  } else {
    const id = filtrosExportados.get('conta_id')
    metadados.push(['Conta', id ? nomeDaConta(id) : 'Todas'])
    metadados.push([
      dominio === 'receita' ? 'Recebimento' : 'Vencimento',
      `${filtrosExportados.get('de') ? dataFinanceira(filtrosExportados.get('de')!) : 'Sem início definido'} a ${filtrosExportados.get('ate') ? dataFinanceira(filtrosExportados.get('ate')!) : 'Sem fim definido'}`,
    ])
    if (dominio === 'despesa') {
      const status = filtrosExportados.get('status')
      metadados.push([
        'Status',
        status === 'paga' ? 'Paga' : status === 'pendente' ? 'Pendente' : 'Todos',
      ])
      metadados.push(['Categoria', filtrosExportados.get('categoria') || 'Todas'])
    }
  }
  exportando.value = true
  erroExportacao.value = ''
  let janela: Window | undefined
  try {
    janela = abrirImpressao()
    const token = auth.obterToken()
    const itens = await consultarListagemCompleta<Conta | Receita | Despesa>((inicio) =>
      dominio === 'conta'
        ? listarContas(token, inicio, filtrosExportados)
        : dominio === 'receita'
          ? listarReceitas(token, inicio, filtrosExportados)
          : listarDespesas(token, inicio, filtrosExportados),
    )
    const colunas =
      dominio === 'conta'
        ? ['Nome', 'Tipo', 'Saldo disponível', 'Situação']
        : [
            'Conta',
            'Descrição',
            'Categoria',
            'Valor',
            dominio === 'receita' ? 'Recebimento' : 'Vencimento',
            'Situação',
            ...(dominio === 'despesa' ? ['Status', 'Pagamento'] : []),
          ]
    const linhas = itens.map((item) => {
      if ('nome' in item)
        return [
          item.nome,
          nomesTipoConta[item.tipo],
          moeda(item.saldo_disponivel),
          item.deleted_at ? 'Excluído' : 'Ativo',
        ]
      const linha = [
        nomeDaConta(item.conta_id),
        item.descricao,
        item.categoria,
        moeda(item.valor),
        dataFinanceira('data_recebimento' in item ? item.data_recebimento : item.data_vencimento),
        item.deleted_at ? 'Excluído' : 'Ativo',
      ]
      if ('status' in item)
        linha.push(
          item.status === 'paga' ? 'Paga' : 'Pendente',
          item.data_pagamento ? dataFinanceira(item.data_pagamento) : '—',
        )
      return linha
    })
    imprimirDocumento(janela, documentoListagem(titulo, nome, metadados, colunas, linhas))
    notificacoes.adicionar({
      tipo: 'sucesso',
      titulo: 'Listagem preparada',
      mensagem: 'Use “Salvar como PDF” na janela de impressão para concluir.',
    })
  } catch (falha) {
    janela?.close()
    erroExportacao.value = mensagemErro(falha)
    notificacoes.adicionar({
      tipo: 'erro',
      titulo: 'Não foi possível gerar o PDF.',
      mensagem: erroExportacao.value,
      grupo: 'exportacao-pdf',
    })
  } finally {
    exportando.value = false
  }
}
const tipo = computed(() =>
  route.path === '/contas' ? 'conta' : route.path === '/receitas' ? 'receita' : 'despesa',
)
const registros = ref<(Conta | Receita | Despesa)[]>([])
const contas = ref<Conta[]>([])
const erroContas = ref('')
const editandoConta = ref<Conta>()
const editandoMovimento = ref<Receita | Despesa>()
const carregando = ref(true)
const ocupado = ref(false)
const erro = ref('')
const erroAcao = ref('')
const sucesso = ref('')
const aviso = ref('')
const total = ref(0)
const offset = ref(0)
const detalheId = ref('')
const pagando = ref<Despesa | null>(null)
const filtros = reactive({
  tipo: '',
  situacao: 'ativas',
  conta_id: '',
  status: '',
  categoria: '',
  de: '',
  ate: '',
})
let aplicados = new URLSearchParams({ situacao: 'ativas' })
let consulta = 0
const drawerAberto = computed(() => Boolean(detalheId.value || pagando.value))
const formulario = ref<{ alterado: boolean } | null>(null)
async function carregarContas() {
  erroContas.value = ''
  try {
    contas.value = await todasContas(auth.obterToken(), 'todas')
  } catch (falha) {
    erroContas.value = mensagemErro(falha)
  }
}
function nomeConta(id: string) {
  const conta = contas.value.find((c) => c.id === id)
  return conta ? `${conta.nome}${conta.deleted_at ? ' (excluída)' : ''}` : id
}
function contaExcluida(item: Conta | Receita | Despesa) {
  return 'conta_id' in item && Boolean(contas.value.find((c) => c.id === item.conta_id)?.deleted_at)
}
async function carregar() {
  const atual = ++consulta
  carregando.value = true
  erro.value = ''
  try {
    const token = auth.obterToken()
    const resposta =
      tipo.value === 'conta'
        ? await listarContas(token, offset.value, aplicados)
        : tipo.value === 'receita'
          ? await listarReceitas(token, offset.value, aplicados)
          : await listarDespesas(token, offset.value, aplicados)
    if (atual !== consulta) return
    registros.value = resposta.itens
    total.value = resposta.total
    if (!resposta.itens.length && offset.value > 0) {
      offset.value = Math.max(0, offset.value - 100)
      void carregar()
    }
  } catch (falha) {
    if (atual === consulta) {
      registros.value = []
      erro.value = mensagemErro(falha)
    }
  } finally {
    if (atual === consulta) carregando.value = false
  }
}
function aplicar() {
  if (ocupado.value) return
  if (filtros.de && filtros.ate && filtros.de > filtros.ate) {
    erroAcao.value = 'A data inicial deve ser igual ou anterior à final.'
    return
  }
  erroAcao.value = ''
  const query = new URLSearchParams({ situacao: filtros.situacao })
  const campos =
    tipo.value === 'conta'
      ? (['tipo'] as const)
      : tipo.value === 'receita'
        ? (['conta_id', 'de', 'ate'] as const)
        : (['conta_id', 'de', 'ate', 'status', 'categoria'] as const)
  for (const campo of campos) if (filtros[campo].trim()) query.set(campo, filtros[campo].trim())
  aplicados = query
  offset.value = 0
  void carregar()
}
function limparFiltros() {
  Object.assign(filtros, {
    tipo: '',
    situacao: 'ativas',
    conta_id: '',
    status: '',
    categoria: '',
    de: '',
    ate: '',
  })
  aplicar()
}
function limparEdicao() {
  editandoConta.value = undefined
  editandoMovimento.value = undefined
}
function editar(item: Conta | Receita | Despesa) {
  if (ocupado.value) return
  if (
    formulario.value?.alterado &&
    !window.confirm('Descartar os dados do formulário e editar outro registro?')
  )
    return
  limparEdicao()
  if ('nome' in item) editandoConta.value = item
  else editandoMovimento.value = item
}
async function acao(item: Conta | Receita | Despesa, restaurar = false) {
  if (ocupado.value) return
  const mensagem = restaurar
    ? 'Restaurar este registro? O efeito financeiro será reaplicado conforme as regras do sistema.'
    : tipo.value === 'conta'
      ? 'Excluir esta conta? O saldo deve ser zero e não pode haver despesas pendentes ativas.'
      : 'Excluir este registro? O saldo será ajustado conforme a regra do sistema.'
  if (!window.confirm(mensagem)) return
  ocupado.value = true
  erroAcao.value = sucesso.value = aviso.value = ''
  try {
    const token = auth.obterToken()
    if (tipo.value === 'conta') {
      if (restaurar) await restaurarConta(item.id, token)
      else await excluirConta(item.id, token)
    } else if (tipo.value === 'receita') {
      if (restaurar) await restaurarReceita(item.id, token)
      else await excluirReceita(item.id, token)
    } else {
      const resultado = restaurar
        ? await restaurarDespesa(item.id, token)
        : await excluirDespesa(item.id, token)
      if (resultado.saldo_negativo)
        aviso.value = `A conta está com saldo negativo: ${moeda(resultado.saldo_conta)}.`
    }
    if (editandoConta.value?.id === item.id || editandoMovimento.value?.id === item.id)
      limparEdicao()
    sucesso.value = restaurar
      ? 'Registro restaurado com sucesso.'
      : 'Registro excluído com sucesso.'
    await Promise.all([carregar(), carregarContas()])
  } catch (falha) {
    erroAcao.value = mensagemErro(falha)
  } finally {
    ocupado.value = false
  }
}
function salvo() {
  limparEdicao()
  sucesso.value = 'Registro salvo com sucesso.'
  void carregar()
  void carregarContas()
}
function paginar(delta: number) {
  if (ocupado.value || carregando.value) return
  offset.value = Math.max(0, offset.value + delta)
  void carregar()
}
function fecharDrawer() {
  if (ocupado.value) return
  detalheId.value = ''
  pagando.value = null
}
function iniciarPagamento(item: Despesa) {
  if (ocupado.value) return
  pagando.value = item
  erroAcao.value = aviso.value = sucesso.value = ''
}
function aposPagar(resultado: ResultadoDespesa) {
  pagando.value = null
  if (editandoMovimento.value?.id === resultado.despesa.id) limparEdicao()
  sucesso.value = `Pagamento registrado. Saldo da conta: ${moeda(resultado.saldo_conta)}.`
  aviso.value = resultado.saldo_negativo ? 'A conta ficou com saldo negativo.' : ''
  void carregar()
  void carregarContas()
}
watch(
  () => route.path,
  () => {
    offset.value = 0
    limparEdicao()
    detalheId.value = ''
    pagando.value = null
    erroAcao.value = sucesso.value = aviso.value = ''
    Object.assign(filtros, {
      tipo: '',
      situacao: 'ativas',
      conta_id: '',
      status: '',
      categoria: '',
      de: '',
      ate: '',
    })
    aplicados = new URLSearchParams({ situacao: 'ativas' })
    void carregar()
    void carregarContas()
  },
  { immediate: true },
)
</script>

<template>
  <div class="dashboard-shell secondary-page">
    <main class="dashboard-main" :inert="drawerAberto">
      <RouterLink class="back-control" to="/"><span aria-hidden="true">←</span> Início</RouterLink>
      <header class="page-heading">
        <h1>
          {{ tipo === 'conta' ? 'Contas e caixas' : tipo === 'receita' ? 'Receitas' : 'Despesas' }}
        </h1>
        <p>
          {{
            tipo === 'conta'
              ? 'Gerencie onde seus recursos financeiros ficam armazenados.'
              : tipo === 'receita'
                ? 'Gerencie as entradas financeiras do seu negócio.'
                : 'Acompanhe contas, vencimentos e pagamentos.'
          }}
        </p>
      </header>
      <nav class="domain-tabs" aria-label="Cadastros financeiros">
        <RouterLink to="/receitas"><span aria-hidden="true">↗</span> Receitas</RouterLink>
        <RouterLink to="/despesas"><span aria-hidden="true">↘</span> Despesas</RouterLink>
        <RouterLink to="/contas"><span aria-hidden="true">▣</span> Contas e caixas</RouterLink>
      </nav>
      <RouterLink v-if="tipo === 'despesa'" class="secondary-access" to="/despesas-recorrentes"
        >Despesas recorrentes →</RouterLink
      >
      <section class="panel" :inert="ocupado && !editandoConta && !editandoMovimento">
        <h2>
          {{
            editandoConta || editandoMovimento
              ? tipo === 'conta'
                ? 'Editar conta ou caixa'
                : `Editar ${tipo}`
              : tipo === 'conta'
                ? 'Nova conta ou caixa'
                : `Nova ${tipo}`
          }}
        </h2>
        <ContaForm
          v-if="tipo === 'conta'"
          ref="formulario"
          :key="editandoConta?.id ?? 'nova-conta'"
          :registro="editandoConta"
          @ocupado="ocupado = $event"
          @salvo="salvo"
        />
        <LancamentoForm
          v-else
          ref="formulario"
          :key="`${tipo}-${editandoMovimento?.id ?? 'novo'}`"
          :tipo="tipo"
          :registro="editandoMovimento"
          @ocupado="ocupado = $event"
          @salvo="salvo"
        />
        <button
          v-if="editandoConta || editandoMovimento"
          class="retry"
          :disabled="ocupado"
          @click="limparEdicao"
        >
          Cancelar edição
        </button>
      </section>
      <section class="panel register-list" :aria-busy="carregando">
        <div class="list-heading">
          <h2>Registros cadastrados</h2>
          <button
            type="button"
            class="submit-button pdf-button"
            :disabled="exportando || carregando || ocupado || Boolean(erro)"
            :aria-busy="exportando"
            title="Imprimir a listagem completa ou salvar como PDF"
            aria-label="Imprimir ou salvar como PDF todos os registros dos filtros aplicados"
            @click="exportar"
          >
            <Icon name="baixar" />{{ exportando ? 'Preparando PDF…' : 'Imprimir / PDF' }}
          </button>
        </div>
        <p v-if="erroExportacao" class="form-error" role="alert">{{ erroExportacao }}</p>
        <p class="section-description">Consulte os registros e gerencie suas informações.</p>
        <p v-if="tipo === 'conta'" class="info-note">
          Só é possível excluir contas com saldo zero e sem despesas pendentes ativas. Restaure uma
          conta excluída antes de realizar operações financeiras.
        </p>
        <form class="cadastro-form report-filters" :inert="exportando" @submit.prevent="aplicar">
          <h3 class="filter-heading">Filtros</h3>
          <label v-if="tipo === 'conta'"
            >Tipo<select v-model="filtros.tipo">
              <option value="">Todos</option>
              <option v-for="(nome, codigo) in nomesTipoConta" :key="codigo" :value="codigo">
                {{ nome }}
              </option>
            </select></label
          >
          <label
            >Situação<select v-model="filtros.situacao">
              <option value="ativas">Ativos</option>
              <option value="excluidas">Excluídos</option>
              <option value="todas">Todos</option>
            </select></label
          >
          <template v-if="tipo !== 'conta'">
            <label
              >Conta<select v-model="filtros.conta_id">
                <option value="">Todas</option>
                <option v-for="conta in contas" :key="conta.id" :value="conta.id">
                  {{ conta.nome }}{{ conta.deleted_at ? ' (excluída)' : '' }}
                </option>
              </select></label
            >
            <label
              >{{ tipo === 'despesa' ? 'Vencimento inicial' : 'Recebimento inicial'
              }}<input v-model="filtros.de" type="date"
            /></label>
            <label
              >{{ tipo === 'despesa' ? 'Vencimento final' : 'Recebimento final'
              }}<input v-model="filtros.ate" type="date"
            /></label>
          </template>
          <template v-if="tipo === 'despesa'"
            ><label
              >Status<select v-model="filtros.status">
                <option value="">Todos</option>
                <option value="pendente">Pendente</option>
                <option value="paga">Paga</option>
              </select></label
            ><label>Categoria<input v-model="filtros.categoria" maxlength="50" /></label
          ></template>
          <div class="report-filter-actions">
            <button class="submit-button" :disabled="ocupado || carregando">Aplicar filtros</button
            ><button
              type="button"
              class="retry"
              :disabled="ocupado || carregando"
              @click="limparFiltros"
            >
              Limpar filtros
            </button>
          </div>
        </form>
        <div v-if="erroContas" class="form-error" role="alert">
          <p>{{ erroContas }}</p>
          <button class="retry" @click="carregarContas">Tentar carregar contas</button>
        </div>
        <p v-if="sucesso" class="form-success" role="status">{{ sucesso }}</p>
        <p v-if="aviso" class="form-error" role="status">{{ aviso }}</p>
        <p v-if="erroAcao" class="form-error" role="alert">{{ erroAcao }}</p>
        <p v-if="carregando" class="state-message" role="status">Carregando registros…</p>
        <div v-else-if="erro" role="alert">
          <p>{{ erro }}</p>
          <button class="retry" @click="carregar">Tentar novamente</button>
        </div>
        <p v-else-if="!total" class="state-message">Nenhum registro encontrado para os filtros.</p>
        <div v-else class="table-scroll" tabindex="0" aria-label="Registros com rolagem horizontal">
          <table>
            <thead>
              <tr>
                <th scope="col">{{ tipo === 'conta' ? 'Conta' : 'Descrição' }}</th>
                <th scope="col">{{ tipo === 'conta' ? 'Tipo' : 'Conta' }}</th>
                <th scope="col" v-if="tipo !== 'conta'">
                  {{ tipo === 'despesa' ? 'Vencimento' : 'Recebimento' }}
                </th>
                <th scope="col" v-if="tipo !== 'conta'">Categoria</th>
                <th scope="col" class="money-cell">
                  {{ tipo === 'conta' ? 'Saldo disponível' : 'Valor' }}
                </th>
                <th scope="col">Situação</th>
                <th scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in registros" :key="item.id">
                <td>{{ 'nome' in item ? item.nome : item.descricao }}</td>
                <td>{{ 'nome' in item ? nomesTipoConta[item.tipo] : nomeConta(item.conta_id) }}</td>
                <td v-if="'descricao' in item">
                  {{
                    dataFinanceira(
                      'data_vencimento' in item ? item.data_vencimento : item.data_recebimento,
                    )
                  }}
                </td>
                <td v-if="'categoria' in item">{{ item.categoria }}</td>
                <td class="money-cell">
                  {{ moeda('saldo_disponivel' in item ? item.saldo_disponivel : item.valor) }}
                </td>
                <td>
                  <span
                    class="status-badge"
                    :class="
                      item.deleted_at
                        ? 'status-deleted'
                        : 'status' in item && item.status === 'pendente'
                          ? 'status-pending'
                          : 'status-positive'
                    "
                    >{{
                      item.deleted_at
                        ? 'Excluído'
                        : 'status' in item
                          ? item.status === 'paga'
                            ? 'Paga'
                            : 'Pendente'
                          : 'Ativo'
                    }}</span
                  ><small v-if="contaExcluida(item)"> — restaure a conta para operar</small>
                </td>
                <td class="row-actions">
                  <button class="retry" :disabled="ocupado" @click="detalheId = item.id">
                    Detalhes
                  </button>
                  <button
                    v-if="item.deleted_at"
                    class="retry"
                    :disabled="ocupado || contaExcluida(item)"
                    @click="acao(item, true)"
                  >
                    Restaurar
                  </button>
                  <template v-else
                    ><button
                      class="retry"
                      :disabled="ocupado || (contaExcluida(item) && tipo !== 'receita')"
                      @click="editar(item)"
                    >
                      Editar</button
                    ><button
                      class="retry action-danger"
                      :disabled="ocupado || contaExcluida(item)"
                      @click="acao(item)"
                    >
                      Excluir</button
                    ><button
                      v-if="'status' in item && item.status === 'pendente'"
                      class="retry action-primary"
                      :disabled="ocupado || contaExcluida(item)"
                      @click="iniciarPagamento(item)"
                    >
                      Pagar
                    </button></template
                  >
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="!carregando && !erro" class="compact-pagination">
          <small>{{ total }} registros</small>
          <button
            class="retry"
            aria-label="Página anterior"
            :disabled="ocupado || offset === 0"
            @click="paginar(-100)"
          >
            ‹</button
          ><span>Página {{ offset / 100 + 1 }}</span
          ><button
            class="retry"
            aria-label="Próxima página"
            :disabled="ocupado || offset + 100 >= total"
            @click="paginar(100)"
          >
            ›
          </button>
        </div>
        <RouterLink v-if="!auth.accessToken" to="/login">Entrar novamente</RouterLink>
      </section>
    </main>
    <SideDrawer
      v-if="drawerAberto"
      :titulo="pagando ? 'Pagar despesa' : 'Detalhes do registro'"
      :ocupado="ocupado"
      subtitulo="Consulta financeira"
      class="report-drawer"
      @fechar="fecharDrawer"
    >
      <PagamentoForm
        v-if="pagando"
        :despesa="pagando"
        @ocupado="ocupado = $event"
        @salvo="aposPagar"
      />
      <RegistroDetalhe v-else :id="detalheId" :dominio="tipo" />
    </SideDrawer>
  </div>
</template>
<style scoped>
.register-list {
  margin-top: 24px;
}
</style>
