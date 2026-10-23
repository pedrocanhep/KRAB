<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { obterExtrato, obterRelatorio, type Extrato, type Relatorio } from '../services/relatorios'
import { moeda, dataFinanceira } from '../services/dashboard'
import { mensagemErro } from '../services/http'
import '../assets/dashboard.css'
import '../assets/forms.css'

const route = useRoute()
const auth = useAuthStore()
const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
const inicio = new Date(`${hoje}T12:00:00Z`)
inicio.setUTCDate(inicio.getUTCDate() - 29)
const de = ref(inicio.toISOString().slice(0, 10))
const ate = ref(hoje)
const tipo = ref('todos')
const ordem = ref('data')
const offset = ref(0)
const extrato = ref<Extrato | null>(null)
const relatorio = ref<Relatorio | null>(null)
const carregando = ref(true)
const erro = ref('')
let consulta = 0
async function carregar(novoPeriodo = false) {
  if (novoPeriodo) offset.value = 0
  const atual = ++consulta
  carregando.value = true
  erro.value = ''
  extrato.value = null
  relatorio.value = null
  try {
    if (!de.value || !ate.value || de.value > ate.value)
      throw new Error('Informe um período válido.')
    const filtros = new URLSearchParams({ de: de.value, ate: ate.value })
    if (route.path === '/extrato') {
      filtros.set('tipo', tipo.value)
      filtros.set('ordem', ordem.value)
      filtros.set('offset', String(offset.value))
      filtros.set('limit', '100')
      const dados = await obterExtrato(filtros, auth.obterToken())
      if (consulta === atual) extrato.value = dados
    } else {
      const dados = await obterRelatorio(
        route.path.endsWith('receitas') ? 'receitas' : 'despesas',
        filtros,
        auth.obterToken(),
      )
      if (consulta === atual) relatorio.value = dados
    }
  } catch (falha) {
    if (consulta === atual) erro.value = mensagemErro(falha)
  } finally {
    if (consulta === atual) carregando.value = false
  }
}
function paginar(delta: number) {
  offset.value += delta
  void carregar()
}
watch(
  () => route.path,
  () => carregar(true),
  { immediate: true },
)
</script>

<template>
  <div class="dashboard-shell">
    <main class="dashboard-main">
      <RouterLink to="/">← Voltar ao início</RouterLink>
      <h1>
        {{
          route.path === '/extrato'
            ? 'Extrato financeiro'
            : route.path.endsWith('receitas')
              ? 'Relatório de receitas'
              : 'Relatório de despesas'
        }}
      </h1>
      <nav class="report-navigation">
        <RouterLink to="/extrato">Extrato</RouterLink
        ><RouterLink to="/relatorios/receitas">Receitas</RouterLink
        ><RouterLink to="/relatorios/despesas">Despesas</RouterLink>
      </nav>
      <section class="panel">
        <form class="cadastro-form report-filters" @submit.prevent="carregar(true)">
          <label>De<input v-model="de" type="date" required /></label>
          <label>Até<input v-model="ate" type="date" required /></label>
          <template v-if="route.path === '/extrato'">
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
          <button class="submit-button" :disabled="carregando">Consultar</button>
        </form>
        <p class="state-message">
          O extrato e os totais consideram receitas recebidas e despesas pagas nas contas ativas.
          Despesas pendentes aparecem separadamente.
        </p>
        <p v-if="carregando" role="status">Carregando relatório…</p>
        <div v-else-if="erro" role="alert">
          <p>{{ erro }}</p>
          <button class="retry" @click="carregar()">Tentar novamente</button
          ><RouterLink v-if="!auth.accessToken" to="/login">Entrar novamente</RouterLink>
        </div>
        <template v-else-if="extrato">
          <p>
            Entradas: {{ moeda(extrato.totais.entradas) }} • Saídas:
            {{ moeda(extrato.totais.saidas) }} • Resultado do período:
            {{ moeda(extrato.totais.saldo_periodo) }} • Saldo atual:
            {{ moeda(extrato.saldo_atual) }}
          </p>
          <p v-if="!extrato.itens.length" class="state-message">
            Nenhuma movimentação encontrada neste período.
          </p>
          <div v-else class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Conta</th>
                  <th>Categoria</th>
                  <th>Tipo</th>
                  <th>Valor</th>
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
            ><span>{{ extrato.totais.quantidade }} movimentações</span
            ><button
              class="retry"
              :disabled="offset + 100 >= extrato.totais.quantidade"
              @click="paginar(100)"
            >
              Próxima
            </button>
          </div>
        </template>
        <template v-else-if="relatorio">
          <p>Total: {{ moeda(relatorio.total) }} • {{ relatorio.quantidade }} registros</p>
          <p v-if="relatorio.a_pagar" class="state-message">
            A pagar no período: {{ moeda(relatorio.a_pagar.total) }} •
            {{ relatorio.a_pagar.quantidade }} despesas pendentes
          </p>
          <p v-if="!relatorio.categorias.length" class="state-message">
            Nenhum registro efetivado neste período.
          </p>
          <div v-else class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Quantidade</th>
                  <th>Total</th>
                  <th>Participação</th>
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
      </section>
    </main>
  </div>
</template>
