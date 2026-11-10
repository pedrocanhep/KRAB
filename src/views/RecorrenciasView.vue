<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import SideDrawer from '../components/dashboard/SideDrawer.vue'
import RecorrenciaForm from '../components/forms/RecorrenciaForm.vue'
import {
  listarRecorrencias,
  obterRecorrencia,
  finalizarRecorrencia,
  gerarOcorrencias,
  frequencias,
  type Recorrencia,
  type DetalheRecorrencia,
} from '../services/recorrencias'
import { todasContas, type Conta } from '../services/contas'
import { moeda, dataFinanceira, dataHora } from '../services/dashboard'
import { mensagemErro } from '../services/http'
import { useAuthStore } from '../stores/auth'
import '../assets/dashboard.css'
import '../assets/forms.css'
import '../assets/secondary.css'
const auth = useAuthStore()
const itens = ref<Recorrencia[]>([])
const contas = ref<Conta[]>([])
const status = ref('')
let statusAplicado = ''
const offset = ref(0)
const total = ref(0)
const carregando = ref(false)
const ocupado = ref(false)
const erro = ref('')
const erroAcao = ref('')
const sucesso = ref('')
const modo = ref<'novo' | 'editar' | 'detalhe' | null>(null)
const selecionada = ref<Recorrencia>()
const detalhe = ref<DetalheRecorrencia | null>(null)
const erroDetalhe = ref('')
const carregandoDetalhe = ref(false)
const formulario = ref<{ alterado: boolean } | null>(null)
const drawerAberto = computed(() => modo.value !== null)
let consulta = 0
let consultaDetalhe = 0
function nomeConta(id: string) {
  const c = contas.value.find((c) => c.id === id)
  return c ? `${c.nome}${c.deleted_at ? ' (excluída)' : ''}` : id
}
async function carregar() {
  const atual = ++consulta
  carregando.value = true
  erro.value = ''
  try {
    const query = new URLSearchParams({ limit: '50', offset: String(offset.value) })
    if (statusAplicado) query.set('status', statusAplicado)
    const dados = await listarRecorrencias(auth.obterToken(), query)
    if (atual !== consulta) return
    itens.value = dados.itens
    total.value = dados.total
    if (!dados.itens.length && offset.value > 0) {
      offset.value = Math.max(0, offset.value - 50)
      void carregar()
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
async function carregarDetalhe() {
  if (!selecionada.value) return
  const atual = ++consultaDetalhe
  carregandoDetalhe.value = true
  erroDetalhe.value = ''
  detalhe.value = null
  try {
    const dados = await obterRecorrencia(selecionada.value.id, auth.obterToken())
    if (atual === consultaDetalhe) detalhe.value = dados
  } catch (falha) {
    if (atual === consultaDetalhe) erroDetalhe.value = mensagemErro(falha)
  } finally {
    if (atual === consultaDetalhe) carregandoDetalhe.value = false
  }
}
function abrir(registro?: Recorrencia, editar = false) {
  selecionada.value = registro
  modo.value = !registro ? 'novo' : editar ? 'editar' : 'detalhe'
  if (modo.value === 'detalhe') void carregarDetalhe()
}
function fechar() {
  if (ocupado.value) return
  if (formulario.value?.alterado && !window.confirm('Descartar as alterações e fechar?')) return
  consultaDetalhe++
  modo.value = null
}
function salvo(quantidade: number) {
  modo.value = null
  sucesso.value = `Recorrência salva. ${quantidade} ocorrências geradas.`
  void carregar()
}
async function executar(registro?: Recorrencia) {
  if (ocupado.value) return
  if (
    registro &&
    !window.confirm(
      'Finalizar esta recorrência? As despesas pendentes com vencimento após hoje serão canceladas.',
    )
  )
    return
  ocupado.value = true
  erroAcao.value = sucesso.value = ''
  try {
    if (registro) {
      const r = await finalizarRecorrencia(registro.id, auth.obterToken())
      sucesso.value = `Recorrência finalizada. ${r.ocorrencias_canceladas} ocorrências canceladas.`
    } else {
      const r = await gerarOcorrencias(auth.obterToken())
      sucesso.value = `Atualização concluída. ${r.ocorrencias_geradas} ocorrências geradas.`
    }
    await carregar()
  } catch (falha) {
    erroAcao.value = mensagemErro(falha)
  } finally {
    ocupado.value = false
  }
}
function aplicar() {
  statusAplicado = status.value
  offset.value = 0
  void carregar()
}
function paginar(delta: number) {
  offset.value = Math.max(0, offset.value + delta)
  void carregar()
}
async function carregarContas() {
  try {
    contas.value = await todasContas(auth.obterToken(), 'todas')
  } catch {
    /* O detalhe mantém o identificador quando o nome não puder ser carregado. */
  }
}
void carregar()
void carregarContas()
</script>
<template>
  <div class="dashboard-shell secondary-page">
    <main class="dashboard-main" :inert="drawerAberto">
      <RouterLink class="back-control" to="/despesas">← Despesas</RouterLink>
      <h1>Despesas recorrentes</h1>
      <section class="panel">
        <p>
          Configure despesas que se repetem. Pague cada ocorrência na área de despesas quando o
          pagamento acontecer.
        </p>
        <div class="report-navigation">
          <button class="submit-button" :disabled="ocupado || !auth.accessToken" @click="abrir()">
            Nova recorrência</button
          ><button class="retry" :disabled="ocupado || !auth.accessToken" @click="executar()">
            Atualizar ocorrências disponíveis
          </button>
        </div>
        <p class="form-hint">
          A atualização manual gera as ocorrências ainda não disponíveis. Não registra pagamentos
          nem exige uso diário.
        </p>
        <form class="cadastro-form report-filters" @submit.prevent="aplicar">
          <label
            >Status<select v-model="status">
              <option value="">Todos</option>
              <option value="ativa">Ativa</option>
              <option value="finalizada">Finalizada</option>
            </select></label
          ><button class="submit-button" :disabled="carregando || ocupado">Aplicar filtro</button>
        </form>
        <p v-if="sucesso" class="form-success" role="status">{{ sucesso }}</p>
        <p v-if="erroAcao" class="form-error" role="alert">{{ erroAcao }}</p>
        <p v-if="carregando" role="status">Carregando recorrências…</p>
        <div v-else-if="erro" class="form-error" role="alert">
          <p>{{ erro }}</p>
          <button class="retry" @click="carregar">Tentar novamente</button>
        </div>
        <p v-else-if="!itens.length" class="state-message">Nenhuma recorrência encontrada.</p>
        <div
          v-else
          class="table-scroll"
          tabindex="0"
          aria-label="Recorrências com rolagem horizontal"
        >
          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Conta</th>
                <th>Valor</th>
                <th>Frequência</th>
                <th>Início</th>
                <th>Fim</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in itens" :key="item.id">
                <td>{{ item.descricao }}</td>
                <td>{{ nomeConta(item.conta_id) }}</td>
                <td>{{ moeda(item.valor) }}</td>
                <td>{{ frequencias[item.frequencia] }}</td>
                <td>{{ dataFinanceira(item.data_inicio) }}</td>
                <td>{{ item.data_fim ? dataFinanceira(item.data_fim) : 'Sem fim definido' }}</td>
                <td>
                  <span
                    class="status-badge"
                    :class="item.status === 'ativa' ? 'status-positive' : 'status-deleted'"
                    >{{ item.status === 'ativa' ? 'Ativa' : 'Finalizada' }}</span
                  >
                </td>
                <td class="row-actions">
                  <button class="retry" :disabled="ocupado" @click="abrir(item)">Detalhes</button
                  ><button
                    v-if="item.status === 'ativa'"
                    class="retry"
                    :disabled="ocupado"
                    @click="abrir(item, true)"
                  >
                    Editar</button
                  ><button
                    v-if="item.status === 'ativa'"
                    class="retry"
                    :disabled="ocupado"
                    @click="executar(item)"
                  >
                    Finalizar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="!carregando && !erro" class="compact-pagination">
          <small>{{ total }} recorrências</small>
          <button
            class="retry"
            aria-label="Página anterior"
            :disabled="ocupado || offset === 0"
            @click="paginar(-50)"
          >
            ‹</button
          ><span>Página {{ offset / 50 + 1 }}</span
          ><button
            class="retry"
            aria-label="Próxima página"
            :disabled="ocupado || offset + 50 >= total"
            @click="paginar(50)"
          >
            ›
          </button>
        </div>
        <RouterLink v-if="!auth.accessToken" to="/login">Entrar novamente</RouterLink>
      </section>
    </main>
    <SideDrawer
      v-if="modo"
      :titulo="
        modo === 'novo'
          ? 'Nova recorrência'
          : modo === 'editar'
            ? 'Editar recorrência'
            : 'Detalhes da recorrência'
      "
      :ocupado="ocupado"
      class="report-drawer"
      subtitulo="Despesas recorrentes"
      @fechar="fechar"
    >
      <RecorrenciaForm
        v-if="modo !== 'detalhe'"
        ref="formulario"
        :registro="modo === 'editar' ? selecionada : undefined"
        @ocupado="ocupado = $event"
        @salvo="salvo"
      />
      <template v-else>
        <p v-if="carregandoDetalhe" role="status">Carregando detalhes…</p>
        <div v-else-if="erroDetalhe" class="form-error" role="alert">
          <p>{{ erroDetalhe }}</p>
          <button class="retry" @click="carregarDetalhe">Tentar novamente</button>
        </div>
        <template v-else-if="detalhe"
          ><dl class="detail-fields">
            <div>
              <dt>Descrição</dt>
              <dd>{{ detalhe.descricao }}</dd>
            </div>
            <div>
              <dt>Conta</dt>
              <dd>{{ nomeConta(detalhe.conta_id) }}</dd>
            </div>
            <div>
              <dt>Valor</dt>
              <dd>{{ moeda(detalhe.valor) }}</dd>
            </div>
            <div>
              <dt>Categoria</dt>
              <dd>{{ detalhe.categoria }}</dd>
            </div>
            <div>
              <dt>Frequência</dt>
              <dd>{{ frequencias[detalhe.frequencia] }}</dd>
            </div>
            <div>
              <dt>Início</dt>
              <dd>{{ dataFinanceira(detalhe.data_inicio) }}</dd>
            </div>
            <div>
              <dt>Fim</dt>
              <dd>
                {{ detalhe.data_fim ? dataFinanceira(detalhe.data_fim) : 'Sem fim definido' }}
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{{ detalhe.status === 'ativa' ? 'Ativa' : 'Finalizada' }}</dd>
            </div>
            <div v-if="detalhe.finalizada_em">
              <dt>Finalizada em</dt>
              <dd>{{ dataHora(detalhe.finalizada_em) }}</dd>
            </div>
          </dl>
          <h3>Ocorrências disponíveis</h3>
          <p class="form-hint">
            Até 200 ocorrências não excluídas, ordenadas por vencimento. Gerencie pagamentos e
            exclusões em <RouterLink to="/despesas">Despesas</RouterLink>.
          </p>
          <p v-if="!detalhe.ocorrencias.length">Nenhuma ocorrência disponível.</p>
          <div
            v-else
            class="table-scroll"
            tabindex="0"
            aria-label="Ocorrências com rolagem horizontal"
          >
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Pagamento</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="oc in detalhe.ocorrencias" :key="oc.id">
                  <td>{{ oc.descricao }}</td>
                  <td>{{ dataFinanceira(oc.data_vencimento) }}</td>
                  <td>{{ moeda(oc.valor) }}</td>
                  <td>{{ oc.status === 'paga' ? 'Paga' : 'Pendente' }}</td>
                  <td>{{ oc.data_pagamento ? dataFinanceira(oc.data_pagamento) : 'Não pago' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
        <RouterLink v-if="!auth.accessToken" to="/login">Entrar novamente</RouterLink>
      </template>
    </SideDrawer>
  </div>
</template>
