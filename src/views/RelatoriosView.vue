<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { obterExtrato, obterRelatorio, type Extrato, type Relatorio } from '../services/relatorios'
import { todasContas, type Conta } from '../services/contas'
import { moeda, dataFinanceira } from '../services/dashboard'
import { mensagemErro } from '../services/http'
import '../assets/forms.css'

const route = useRoute()
const auth = useAuthStore()
const natureza = computed(() =>
  route.path === '/extrato' ? 'todos' : route.path.endsWith('receitas') ? 'receitas' : 'despesas',
)
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
    contas.value = await todasContas(auth.obterToken())
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
  offset.value += delta
  void carregar()
}
onMounted(() => {
  void carregarContas()
  void carregar()
})
</script>

<template>
  <div class="report-content" :aria-busy="carregando">
    <form class="cadastro-form report-filters" @submit.prevent="aplicar">
      <label>Data inicial<input v-model="de" type="date" required /></label>
      <label>Data final<input v-model="ate" type="date" required /></label>
      <label
        >Conta<select v-model="contaId" :disabled="carregandoContas || Boolean(erroContas)">
          <option value="">Todas as contas ativas</option>
          <option v-for="conta in contas" :key="conta.id" :value="conta.id">
            {{ conta.nome }}
          </option>
        </select></label
      >
      <template v-if="natureza === 'todos'">
        <label
          >Tipo<select v-model="tipo">
            <option value="todos">Todos</option>
            <option value="receitas">Receitas</option>
            <option value="despesas">Despesas pagas</option>
          </select></label
        >
        <label
          >Ordenar por<select v-model="ordem">
            <option value="data">Data</option>
            <option value="categoria">Categoria</option>
          </select></label
        >
      </template>
      <div class="report-filter-actions">
        <button class="submit-button" :disabled="carregando">Aplicar filtros</button
        ><button type="button" class="retry" :disabled="carregando" @click="limpar">
          Limpar filtros
        </button>
      </div>
    </form>
    <p v-if="carregandoContas" role="status">Carregando contas…</p>
    <div v-else-if="erroContas" class="form-error" role="alert">
      <p>Não foi possível carregar as opções de conta. {{ erroContas }}</p>
      <button class="retry" @click="carregarContas">Tentar carregar contas</button>
    </div>
    <p class="state-message">
      Valores efetivados: receitas por recebimento e despesas por pagamento. O período padrão
      corresponde aos últimos 30 dias.
    </p>
    <p v-if="carregando" role="status">Carregando relatório…</p>
    <div v-else-if="erro" class="form-error" role="alert">
      <p>{{ erro }}</p>
      <button class="retry" @click="carregar">Tentar novamente</button
      ><RouterLink v-if="!auth.accessToken" to="/login">Entrar novamente</RouterLink>
    </div>
    <template v-else-if="extrato">
      <p class="form-hint">
        Período consultado: {{ dataFinanceira(extrato.periodo.de) }} a
        {{ dataFinanceira(extrato.periodo.ate) }}
      </p>
      <template v-if="relatorio">
        <p class="report-total">
          {{ natureza === 'receitas' ? 'Total recebido' : 'Total pago' }}:
          <strong>{{ moeda(relatorio.total) }}</strong> • {{ relatorio.quantidade }} registros
        </p>
        <p v-if="relatorio.a_pagar" class="state-message">
          A pagar por vencimento no período: {{ moeda(relatorio.a_pagar.total) }} •
          {{ relatorio.a_pagar.quantidade }} despesas pendentes
        </p>
        <div v-if="relatorio.categorias.length" class="table-scroll">
          <table>
            <caption>
              Totais por categoria
            </caption>
            <thead>
              <tr>
                <th scope="col">Categoria</th>
                <th scope="col">Quantidade</th>
                <th scope="col">Total</th>
                <th scope="col">Participação</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="categoria in relatorio.categorias" :key="categoria.categoria">
                <td>{{ categoria.categoria }}</td>
                <td>{{ categoria.quantidade }}</td>
                <td>{{ moeda(categoria.total) }}</td>
                <td>{{ categoria.percentual.toLocaleString('pt-BR') }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <p v-else class="report-total">
        Entradas: {{ moeda(extrato.totais.entradas) }} • Saídas:
        {{ moeda(extrato.totais.saidas) }} • Resultado do período:
        {{ moeda(extrato.totais.saldo_periodo) }} • Saldo atual: {{ moeda(extrato.saldo_atual) }}
      </p>
      <p v-if="!extrato.itens.length" class="state-message">
        {{
          natureza === 'receitas'
            ? 'Nenhuma receita encontrada para os filtros selecionados.'
            : natureza === 'despesas'
              ? 'Nenhuma despesa encontrada para os filtros selecionados.'
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
      <div class="report-navigation">
        <button class="retry" :disabled="offset === 0" @click="paginar(-100)">Anterior</button
        ><span>{{ extrato.totais.quantidade }} registros • Página {{ offset / 100 + 1 }}</span
        ><button
          class="retry"
          :disabled="offset + 100 >= extrato.totais.quantidade"
          @click="paginar(100)"
        >
          Próxima
        </button>
      </div>
    </template>
  </div>
</template>
