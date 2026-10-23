<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import LancamentoForm from '../components/forms/LancamentoForm.vue'
import ContaForm from '../components/forms/ContaForm.vue'
import { listarContas, excluirConta, type Conta } from '../services/contas'
import { listarReceitas, excluirReceita, type Receita } from '../services/receitas'
import { listarDespesas, excluirDespesa, pagarDespesa, type Despesa } from '../services/despesas'
import { moeda, dataFinanceira } from '../services/dashboard'
import { mensagemErro } from '../services/http'
import { useAuthStore } from '../stores/auth'
import '../assets/dashboard.css'
const route = useRoute()
const auth = useAuthStore()
const tipo = computed(() =>
  route.path === '/contas' ? 'conta' : route.path === '/receitas' ? 'receita' : 'despesa',
)
const contas = ref<Conta[]>([])
const receitas = ref<Receita[]>([])
const despesas = ref<Despesa[]>([])
const editandoConta = ref<Conta>()
const editandoMovimento = ref<Receita | Despesa>()
const carregando = ref(true)
const ocupado = ref(false)
const erro = ref('')
const erroAcao = ref('')
const sucesso = ref('')
const total = ref(0)
const offset = ref(0)
let consulta = 0
async function carregar() {
  const atual = ++consulta
  carregando.value = true
  erro.value = ''
  try {
    const token = auth.obterToken()
    const resposta =
      tipo.value === 'conta'
        ? await listarContas(token, offset.value)
        : tipo.value === 'receita'
          ? await listarReceitas(token, offset.value)
          : await listarDespesas(token, offset.value)
    if (atual !== consulta) return
    if (tipo.value === 'conta') contas.value = resposta.itens as Conta[]
    else if (tipo.value === 'receita') receitas.value = resposta.itens as Receita[]
    else despesas.value = resposta.itens as Despesa[]
    total.value = resposta.total
    if (!resposta.itens.length && offset.value > 0) {
      offset.value = Math.max(0, offset.value - 100)
      void carregar()
    }
  } catch (falha) {
    if (atual === consulta) erro.value = mensagemErro(falha)
  } finally {
    if (atual === consulta) carregando.value = false
  }
}
async function acao(id: string, pagar = false) {
  if (ocupado.value) return
  if (
    !window.confirm(
      pagar
        ? 'Confirmar o pagamento integral desta despesa hoje?'
        : 'Excluir este registro? O saldo será ajustado conforme a regra do sistema.',
    )
  )
    return
  ocupado.value = true
  erroAcao.value = sucesso.value = ''
  try {
    const token = auth.obterToken()
    if (pagar) await pagarDespesa(id, token)
    else if (tipo.value === 'conta') await excluirConta(id, token)
    else if (tipo.value === 'receita') await excluirReceita(id, token)
    else await excluirDespesa(id, token)
    sucesso.value = pagar ? 'Pagamento registrado com sucesso.' : 'Registro excluído com sucesso.'
    await carregar()
  } catch (falha) {
    erroAcao.value = mensagemErro(falha)
  } finally {
    ocupado.value = false
  }
}
function limparEdicao() {
  editandoConta.value = undefined
  editandoMovimento.value = undefined
}
function salvo() {
  limparEdicao()
  sucesso.value = 'Registro salvo com sucesso.'
  void carregar()
}
function paginar(delta: number) {
  offset.value += delta
  void carregar()
}
watch(
  () => route.path,
  () => {
    offset.value = 0
    editandoConta.value = undefined
    editandoMovimento.value = undefined
    erroAcao.value = sucesso.value = ''
    void carregar()
  },
  { immediate: true },
)
</script>

<template>
  <div class="dashboard-shell">
    <main class="dashboard-main">
      <RouterLink to="/">← Voltar ao início</RouterLink>
      <h1>
        {{ tipo === 'conta' ? 'Contas e caixas' : tipo === 'receita' ? 'Receitas' : 'Despesas' }}
      </h1>
      <nav class="report-navigation">
        <RouterLink to="/receitas">Receitas</RouterLink
        ><RouterLink to="/despesas">Despesas</RouterLink
        ><RouterLink to="/contas">Contas</RouterLink>
      </nav>
      <section class="panel" :inert="ocupado && !editandoConta && !editandoMovimento">
        <h2>{{ editandoConta || editandoMovimento ? 'Editar registro' : 'Novo registro' }}</h2>
        <ContaForm
          v-if="tipo === 'conta'"
          :key="editandoConta?.id ?? 'nova-conta'"
          :registro="editandoConta"
          @ocupado="ocupado = $event"
          @salvo="salvo"
        />
        <LancamentoForm
          v-else
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
        <h2>Registros cadastrados</h2>
        <p v-if="sucesso" class="form-success" role="status">{{ sucesso }}</p>
        <p v-if="erroAcao" class="form-error" role="alert">{{ erroAcao }}</p>
        <p v-if="carregando" class="state-message" role="status">Carregando registros…</p>
        <div v-else-if="erro" role="alert">
          <p>{{ erro }}</p>
          <button class="retry" @click="carregar">Tentar novamente</button>
        </div>
        <p v-else-if="!total" class="state-message">Nenhum registro cadastrado ainda.</p>
        <div v-else class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{{ tipo === 'conta' ? 'Conta' : 'Descrição' }}</th>
                <th>{{ tipo === 'conta' ? 'Tipo' : 'Data' }}</th>
                <th>{{ tipo === 'conta' ? 'Saldo disponível' : 'Valor' }}</th>
                <th v-if="tipo === 'despesa'">Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody v-if="tipo === 'conta'">
              <tr v-for="conta in contas" :key="conta.id">
                <td>{{ conta.nome }}</td>
                <td>
                  {{
                    {
                      corrente: 'Conta corrente',
                      poupanca: 'Poupança',
                      caixa: 'Caixa',
                      outro: 'Outro',
                    }[conta.tipo]
                  }}
                </td>
                <td>{{ moeda(conta.saldo_disponivel) }}</td>
                <td>
                  <button class="retry" :disabled="ocupado" @click="editandoConta = conta">
                    Editar
                  </button>
                  <button class="retry" :disabled="ocupado" @click="acao(conta.id)">Excluir</button>
                </td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr v-for="item in tipo === 'receita' ? receitas : despesas" :key="item.id">
                <td>{{ item.descricao }}</td>
                <td>
                  {{
                    dataFinanceira(
                      'data_vencimento' in item ? item.data_vencimento : item.data_recebimento,
                    )
                  }}
                </td>
                <td>{{ moeda(item.valor) }}</td>
                <td v-if="'status' in item">{{ item.status === 'paga' ? 'Paga' : 'Pendente' }}</td>
                <td>
                  <button class="retry" :disabled="ocupado" @click="editandoMovimento = item">
                    Editar
                  </button>
                  <button class="retry" :disabled="ocupado" @click="acao(item.id)">Excluir</button>
                  <button
                    v-if="'status' in item && item.status === 'pendente'"
                    class="retry"
                    :disabled="ocupado"
                    @click="acao(item.id, true)"
                  >
                    Pagar hoje
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="!carregando && !erro" class="report-navigation">
          <button class="retry" :disabled="ocupado || offset === 0" @click="paginar(-100)">
            Anterior</button
          ><span>{{ total }} registros</span
          ><button class="retry" :disabled="ocupado || offset + 100 >= total" @click="paginar(100)">
            Próxima
          </button>
        </div>
        <RouterLink v-if="!auth.accessToken" to="/login">Entrar novamente</RouterLink>
      </section>
    </main>
  </div>
</template>
<style scoped>
@import '../assets/forms.css';
.register-list {
  margin-top: 24px;
}
</style>
