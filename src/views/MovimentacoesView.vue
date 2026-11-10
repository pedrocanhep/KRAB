<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { listarMovimentacoes, type MovimentoSaldo } from '../services/movimentacoes'
import { todasContas, type Conta } from '../services/contas'
import { moeda, dataHora } from '../services/dashboard'
import { mensagemErro } from '../services/http'
import { useAuthStore } from '../stores/auth'
import '../assets/dashboard.css'
import '../assets/forms.css'
const route = useRoute()
const auth = useAuthStore()
const filtros = reactive({ conta_id: '', de: '', ate: '', origem: 'todas' })
const contas = ref<Conta[]>([])
const carregandoContas = ref(false)
const erroContas = ref('')
const itens = ref<MovimentoSaldo[]>([])
const total = ref(0)
const offset = ref(0)
const carregando = ref(true)
const erro = ref('')
const erroFiltro = ref('')
let aplicados = new URLSearchParams()
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
  try {
    const query = new URLSearchParams(aplicados)
    query.set('limit', '50')
    query.set('offset', String(offset.value))
    const dados = await listarMovimentacoes(auth.obterToken(), query)
    if (atual === consulta) {
      itens.value = dados.itens
      total.value = dados.total
    }
  } catch (falha) {
    if (atual === consulta) {
      itens.value = []
      erro.value = mensagemErro(falha)
    }
  } finally {
    if (atual === consulta) carregando.value = false
  }
}
function aplicar() {
  erroFiltro.value = ''
  if (filtros.de && filtros.ate && filtros.de > filtros.ate) {
    erroFiltro.value = 'A data inicial deve ser igual ou anterior à final.'
    return
  }
  aplicados = new URLSearchParams({ origem: filtros.origem })
  for (const campo of ['conta_id', 'de', 'ate'] as const)
    if (filtros[campo]) aplicados.set(campo, filtros[campo])
  offset.value = 0
  void carregar()
}
function limpar() {
  Object.assign(filtros, { conta_id: '', de: '', ate: '', origem: 'todas' })
  aplicar()
}
function paginar(delta: number) {
  offset.value = Math.max(0, offset.value + delta)
  void carregar()
}
watch(
  () => route.query.conta_id,
  (valor) => {
    filtros.conta_id = typeof valor === 'string' ? valor : ''
    aplicar()
  },
  { immediate: true },
)
void carregarContas()
</script>
<template>
  <div class="dashboard-shell">
    <main class="dashboard-main">
      <RouterLink to="/contas">← Voltar às contas</RouterLink>
      <h1>Histórico de saldo</h1>
      <section class="panel">
        <p>
          Eventos que alteraram o saldo: saldo inicial, recebimentos, pagamentos, ajustes e
          estornos. Não é o extrato dos lançamentos atuais.
        </p>
        <p class="form-hint">
          As datas filtram quando o evento foi registrado em São Paulo. Sem datas, consulta todo o
          histórico. Sem conta específica, considera contas ativas.
        </p>
        <form class="cadastro-form report-filters" @submit.prevent="aplicar">
          <label
            >Conta<select v-model="filtros.conta_id" :disabled="carregandoContas">
              <option value="">Todas as contas ativas</option>
              <option v-for="conta in contas" :key="conta.id" :value="conta.id">
                {{ conta.nome }}{{ conta.deleted_at ? ' (excluída)' : '' }}
              </option>
            </select></label
          ><label>Data inicial do evento<input v-model="filtros.de" type="date" /></label
          ><label>Data final do evento<input v-model="filtros.ate" type="date" /></label
          ><label
            >Origem<select v-model="filtros.origem">
              <option value="todas">Todas</option>
              <option value="receita">Receita</option>
              <option value="despesa">Despesa</option>
              <option value="ajuste">Ajuste</option>
            </select></label
          >
          <div class="report-filter-actions">
            <button class="submit-button" :disabled="carregando">Aplicar filtros</button
            ><button type="button" class="retry" :disabled="carregando" @click="limpar">
              Limpar filtros
            </button>
          </div>
        </form>
        <p v-if="carregandoContas" role="status">Carregando contas…</p>
        <div v-if="erroContas" class="form-error" role="alert">
          <p>{{ erroContas }}</p>
          <button class="retry" @click="carregarContas">Tentar carregar contas</button>
        </div>
        <p v-if="erroFiltro" class="form-error" role="alert">{{ erroFiltro }}</p>
        <p v-if="carregando" role="status">Carregando histórico…</p>
        <div v-else-if="erro" class="form-error" role="alert">
          <p>{{ erro }}</p>
          <button class="retry" @click="carregar">Tentar novamente</button>
        </div>
        <p v-else-if="!itens.length" class="state-message">
          Nenhum evento encontrado para os filtros.
        </p>
        <div
          v-else
          class="table-scroll"
          tabindex="0"
          aria-label="Histórico de saldo com rolagem horizontal"
        >
          <table>
            <thead>
              <tr>
                <th>Data do evento</th>
                <th>Conta</th>
                <th>Origem</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Motivo</th>
                <th>Evento</th>
                <th>Valor</th>
                <th>Saldo da conta após o evento</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in itens" :key="item.id">
                <td>{{ dataHora(item.created_at) }}</td>
                <td>{{ item.conta_nome }}</td>
                <td>{{ item.origem_tipo }}</td>
                <td>{{ item.descricao ?? 'Sem descrição' }}</td>
                <td>{{ item.categoria ?? 'Sem categoria' }}</td>
                <td>{{ item.motivo }}</td>
                <td>{{ item.rotulo }}</td>
                <td :class="item.valor < 0 ? 'negative' : 'positive'">{{ moeda(item.valor) }}</td>
                <td>{{ moeda(item.saldo_apos) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="!carregando && !erro" class="report-navigation">
          <button class="retry" :disabled="offset === 0" @click="paginar(-50)">Anterior</button
          ><span>{{ total }} eventos • Página {{ offset / 50 + 1 }}</span
          ><button class="retry" :disabled="offset + 50 >= total" @click="paginar(50)">
            Próxima
          </button>
        </div>
        <RouterLink v-if="!auth.accessToken" to="/login">Entrar novamente</RouterLink>
      </section>
    </main>
  </div>
</template>
