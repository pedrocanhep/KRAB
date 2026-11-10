<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { obterExtrato, obterRelatorio, type Extrato, type Relatorio } from '../services/relatorios'
import { todasContas, type Conta } from '../services/contas'
import { moeda, dataFinanceira } from '../services/dashboard'
import { mensagemErro } from '../services/http'
import '../assets/forms.css'
import '../assets/secondary.css'
import Icon from '../components/dashboard/DashboardIcon.vue'
import {
  abrirImpressao,
  imprimirDocumento,
  consultarExtratoCompleto,
  documentoRelatorio,
} from '../services/exportacao-relatorio'
import { useNotificacoesStore } from '../stores/notificacoes'

const route = useRoute()
const auth = useAuthStore()
const natureza = computed(() =>
  route.path === '/extrato' ? 'todos' : route.path.endsWith('receitas') ? 'receitas' : 'despesas',
)
const notificacoes = useNotificacoesStore()
const exportando = ref(false)
const erroExportacao = ref('')
const titulo = computed(() =>
  natureza.value === 'todos' ? 'Extrato financeiro' : `Relatório de ${natureza.value}`,
)
async function exportar() {
  if (exportando.value || carregando.value || !extrato.value || erro.value) return
  const naturezaExportada = natureza.value
  const tituloExportado = titulo.value
  const consultaExportada = new URLSearchParams(aplicados)
  const id = consultaExportada.get('conta_id')
  const conta = id ? (contas.value.find((c) => c.id === id)?.nome ?? id) : 'Todas as contas ativas'
  exportando.value = true
  erroExportacao.value = ''
  // Abra durante o clique para evitar o bloqueador de pop-ups após as consultas.
  let janela: Window | undefined
  try {
    janela = abrirImpressao()
    const filtros = new URLSearchParams(consultaExportada)
    filtros.set(
      'tipo',
      naturezaExportada === 'todos'
        ? (consultaExportada.get('tipo') ?? 'todos')
        : naturezaExportada,
    )
    const dados = await consultarExtratoCompleto(filtros, auth.obterToken())
    const filtrosResumo = new URLSearchParams(consultaExportada)
    filtrosResumo.delete('tipo')
    filtrosResumo.delete('ordem')
    const resumo =
      naturezaExportada === 'todos'
        ? null
        : await obterRelatorio(naturezaExportada, filtrosResumo, auth.obterToken())
    if (
      resumo &&
      (resumo.quantidade !== dados.totais.quantidade ||
        resumo.total !==
          (naturezaExportada === 'receitas' ? dados.totais.entradas : dados.totais.saidas))
    )
      throw new Error('Os dados mudaram durante a exportação. Tente novamente.')
    const nome = `krab-${naturezaExportada === 'todos' ? 'extrato' : `relatorio-${naturezaExportada}`}-${new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })}`
    imprimirDocumento(janela, documentoRelatorio(tituloExportado, conta, dados, resumo, nome))
    notificacoes.adicionar({
      tipo: 'sucesso',
      titulo: 'Relatório preparado',
      mensagem: 'Use “Salvar como PDF” na janela de impressão para concluir.',
    })
  } catch (falha) {
    janela?.close()
    erroExportacao.value = mensagemErro(falha)
    notificacoes.adicionar({
      tipo: 'erro',
      titulo: 'Não foi possível gerar o relatório.',
      mensagem: erroExportacao.value,
      grupo: 'exportacao-pdf',
    })
  } finally {
    exportando.value = false
  }
}
function periodoPadrao() {
  const ate = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  const inicio = new Date(`${ate}T12:00:00Z`)
  inicio.setUTCDate(inicio.getUTCDate() - 29)
  return { de: inicio.toISOString().slice(0, 10), ate }
}
const padrao = periodoPadrao()
const de = ref(padrao.de)
const ate = ref(padrao.ate)
const contaId = ref('')
const tipo = ref('todos')
const ordem = ref('data')
const contas = ref<Conta[]>([])
const carregandoContas = ref(true)
const erroContas = ref('')
const offset = ref(0)
const extrato = ref<Extrato | null>(null)
const relatorio = ref<Relatorio | null>(null)
const carregando = ref(true)
const erro = ref('')
// Só os filtros aplicados participam da paginação e das novas tentativas.
let aplicados = new URLSearchParams(padrao)
let consulta = 0
async function carregarContas() {
  carregandoContas.value = true
  erroContas.value = ''
  try {
    contas.value = await todasContas(auth.obterToken(), 'todas')
  } catch (falha) {
    erroContas.value = mensagemErro(falha)
  } finally {
    carregandoContas.value = false
  }
}
async function carregar() {
  const atual = ++consulta
  carregando.value = true
  erro.value = ''
  extrato.value = null
  relatorio.value = null
  try {
    const token = auth.obterToken()
    const filtros = new URLSearchParams(aplicados)
    filtros.set(
      'tipo',
      natureza.value === 'todos' ? (aplicados.get('tipo') ?? 'todos') : natureza.value,
    )
    filtros.set('offset', String(offset.value))
    filtros.set('limit', '100')
    const filtrosResumo = new URLSearchParams(aplicados)
    filtrosResumo.delete('tipo')
    filtrosResumo.delete('ordem')
    const [dados, resumo] = await Promise.all([
      obterExtrato(filtros, token),
      natureza.value === 'todos'
        ? Promise.resolve(null)
        : obterRelatorio(natureza.value, filtrosResumo, token),
    ])
    if (atual === consulta) {
      extrato.value = dados
      relatorio.value = resumo
    }
  } catch (falha) {
    if (atual === consulta) erro.value = mensagemErro(falha)
  } finally {
    if (atual === consulta) carregando.value = false
  }
}
function aplicar() {
  if (exportando.value || carregando.value) return
  if (!de.value || !ate.value || de.value > ate.value) {
    erro.value = 'Informe uma data inicial igual ou anterior à data final.'
    return
  }
  aplicados = new URLSearchParams({ de: de.value, ate: ate.value })
  if (contaId.value) aplicados.set('conta_id', contaId.value)
  if (natureza.value === 'todos') {
    aplicados.set('tipo', tipo.value)
    aplicados.set('ordem', ordem.value)
  }
  offset.value = 0
  void carregar()
}
function limpar() {
  const periodo = periodoPadrao()
  de.value = periodo.de
  ate.value = periodo.ate
  contaId.value = ''
  tipo.value = 'todos'
  ordem.value = 'data'
  aplicar()
}
function paginar(delta: number) {
  if (carregando.value || exportando.value) return
  offset.value = Math.max(0, offset.value + delta)
  void carregar()
}
onMounted(() => {
  void carregarContas()
  void carregar()
})
</script>

<template>
  <div class="report-content" :aria-busy="carregando">
    <p v-if="erroExportacao" class="form-error" role="alert">{{ erroExportacao }}</p>
    <form class="cadastro-form report-filters" @submit.prevent="aplicar">
      <div class="report-filter-heading">
        <h3>Filtros</h3>
        <button
          type="button"
          class="submit-button pdf-button"
          :aria-busy="exportando"
          title="Imprimir o relatório completo ou salvar como PDF"
          aria-label="Imprimir ou salvar como PDF o relatório completo dos filtros aplicados"
          :disabled="exportando || carregando || !extrato || Boolean(erro)"
          @click="exportar"
        >
          <Icon name="baixar" />{{ exportando ? 'Preparando PDF…' : 'Imprimir / PDF' }}
        </button>
      </div>
      <label>Data inicial<input :disabled="exportando" v-model="de" type="date" required /></label>
      <label>Data final<input :disabled="exportando" v-model="ate" type="date" required /></label>
      <label
        >Conta<select
          v-model="contaId"
          :disabled="exportando || carregandoContas || Boolean(erroContas)"
        >
          <option value="">Todas as contas ativas</option>
          <option v-for="conta in contas" :key="conta.id" :value="conta.id">
            {{ conta.nome }}{{ conta.deleted_at ? ' (excluída)' : '' }}
          </option>
        </select></label
      >
      <template v-if="natureza === 'todos'">
        <label
          >Tipo<select v-model="tipo" :disabled="exportando">
            <option value="todos">Todos</option>
            <option value="receitas">Receitas</option>
            <option value="despesas">Despesas pagas</option>
          </select></label
        >
        <label
          >Ordenar por<select v-model="ordem" :disabled="exportando">
            <option value="data">Data</option>
            <option value="categoria">Categoria</option>
          </select></label
        >
      </template>
      <div class="report-filter-actions">
        <button class="submit-button" :disabled="carregando || exportando">Aplicar filtros</button
        ><button type="button" class="retry" :disabled="carregando || exportando" @click="limpar">
          Limpar filtros
        </button>
      </div>
    </form>
    <p v-if="carregandoContas" role="status">Carregando contas…</p>
    <div v-else-if="erroContas" class="form-error" role="alert">
      <p>Não foi possível carregar as opções de conta. {{ erroContas }}</p>
      <button class="retry" @click="carregarContas">Tentar carregar contas</button>
    </div>
    <p v-if="carregando" role="status">Carregando relatório…</p>
    <div v-else-if="erro" class="form-error" role="alert">
      <p>{{ erro }}</p>
      <button class="retry" @click="carregar">Tentar novamente</button
      ><RouterLink v-if="!auth.accessToken" to="/login">Entrar novamente</RouterLink>
    </div>
    <template v-else-if="extrato">
      <template v-if="relatorio">
        <dl class="report-summary">
          <div>
            <dt>{{ natureza === 'receitas' ? 'Total recebido' : 'Total pago' }}</dt>
            <dd :class="natureza === 'receitas' ? 'positive' : 'negative'">
              {{ moeda(relatorio.total) }}
            </dd>
          </div>
          <div v-if="relatorio.a_pagar">
            <dt>A pagar por vencimento</dt>
            <dd>
              {{ moeda(relatorio.a_pagar.total) }}
              <small>({{ relatorio.a_pagar.quantidade }} pendentes)</small>
            </dd>
          </div>
        </dl>
      </template>
      <dl v-else class="report-summary">
        <div>
          <dt>Entradas</dt>
          <dd class="positive">{{ moeda(extrato.totais.entradas) }}</dd>
        </div>
        <div>
          <dt>Saídas</dt>
          <dd class="negative">{{ moeda(extrato.totais.saidas) }}</dd>
        </div>
        <div>
          <dt>Resultado do período</dt>
          <dd>{{ moeda(extrato.totais.saldo_periodo) }}</dd>
        </div>
        <div>
          <dt>Saldo atual</dt>
          <dd>{{ moeda(extrato.saldo_atual) }}</dd>
        </div>
      </dl>
      <p v-if="!extrato.itens.length" class="state-message">
        {{
          natureza === 'receitas'
            ? 'Nenhuma receita encontrada para os filtros selecionados.'
            : natureza === 'despesas'
              ? 'Nenhuma despesa paga encontrada para os filtros selecionados.'
              : 'Nenhuma movimentação encontrada para este período.'
        }}
      </p>
      <div
        v-else
        class="table-scroll"
        tabindex="0"
        aria-label="Registros do relatório, tabela com rolagem horizontal"
      >
        <table>
          <caption>
            Movimentações efetivadas
          </caption>
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">Descrição</th>
              <th scope="col">Conta</th>
              <th scope="col">Categoria</th>
              <th scope="col">Tipo</th>
              <th scope="col">Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in extrato.itens" :key="`${item.tipo}-${item.id}`">
              <td>{{ dataFinanceira(item.data) }}</td>
              <td>{{ item.descricao }}</td>
              <td>{{ item.conta_nome }}</td>
              <td>{{ item.categoria }}</td>
              <td>{{ item.tipo === 'receita' ? 'Receita' : 'Despesa paga' }}</td>
              <td :class="item.tipo === 'receita' ? 'positive' : 'negative'">
                {{ item.tipo === 'receita' ? '+' : '-' }} {{ moeda(Math.abs(item.valor)) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="compact-pagination">
        <small>{{ extrato.totais.quantidade }} registros</small>
        <button
          class="retry"
          aria-label="Página anterior"
          :disabled="carregando || exportando || offset === 0"
          @click="paginar(-100)"
        >
          ‹</button
        ><span>Página {{ offset / 100 + 1 }}</span
        ><button
          class="retry"
          aria-label="Próxima página"
          :disabled="carregando || exportando || offset + 100 >= extrato.totais.quantidade"
          @click="paginar(100)"
        >
          ›
        </button>
      </div>
    </template>
  </div>
</template>
