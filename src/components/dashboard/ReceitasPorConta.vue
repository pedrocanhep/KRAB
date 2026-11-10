<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { todasContas, type Conta } from '../../services/contas'
import { obterRelatorio, type Relatorio } from '../../services/relatorios'
import { dataFinanceira, hojeSaoPaulo, moeda } from '../../services/dashboard'
import { mensagemErro } from '../../services/http'
import { useAuthStore } from '../../stores/auth'

const props = defineProps<{ versao: number }>()
const auth = useAuthStore()
const contas = ref<Conta[]>([])
const contaId = ref('')
const geral = ref<Relatorio | null>(null)
const porConta = ref<Relatorio | null>(null)
const carregando = ref(true)
const carregandoConta = ref(false)
const erro = ref('')
const erroConta = ref('')
const periodo = ref({ de: '', ate: '' })
let leitura = 0
let selecao = 0

async function carregarConta() {
  const atual = ++selecao
  porConta.value = null
  erroConta.value = ''
  carregandoConta.value = Boolean(contaId.value)
  if (!contaId.value) return
  try {
    const resultado = await obterRelatorio(
      'receitas',
      new URLSearchParams({ ...periodo.value, conta_id: contaId.value }),
      auth.obterToken(),
    )
    if (atual === selecao) porConta.value = resultado
  } catch (falha) {
    if (atual === selecao) erroConta.value = mensagemErro(falha)
  } finally {
    if (atual === selecao) carregandoConta.value = false
  }
}
async function carregar() {
  const atual = ++leitura
  ++selecao
  carregando.value = true
  carregandoConta.value = false
  geral.value = null
  porConta.value = null
  erro.value = ''
  const ate = hojeSaoPaulo()
  const inicio = new Date(`${ate}T00:00:00Z`)
  inicio.setUTCDate(inicio.getUTCDate() - 29)
  periodo.value = { de: inicio.toISOString().slice(0, 10), ate }
  try {
    const [lista, total] = await Promise.all([
      todasContas(auth.obterToken()),
      obterRelatorio('receitas', new URLSearchParams(periodo.value), auth.obterToken()),
    ])
    if (atual !== leitura) return
    contas.value = lista
    geral.value = total
    if (!lista.some((conta) => conta.id === contaId.value)) contaId.value = lista[0]?.id ?? ''
    await carregarConta()
  } catch (falha) {
    if (atual === leitura) erro.value = mensagemErro(falha)
  } finally {
    if (atual === leitura) carregando.value = false
  }
}
onMounted(carregar)
watch(() => props.versao, carregar)
</script>

<template>
  <section class="panel home-revenue" :aria-busy="carregando || carregandoConta">
    <div class="section-heading">
      <div>
        <h2>Receitas por conta</h2>
        <p>Últimos 30 dias · contas e caixas ativos</p>
      </div>
    </div>
    <p v-if="carregando" role="status">Consultando receitas…</p>
    <div v-else-if="erro" role="alert">
      <p>{{ erro }}</p>
      <button class="retry" @click="carregar">Tentar novamente</button>
    </div>
    <template v-else>
      <p class="home-period">
        {{ dataFinanceira(periodo.de) }} a {{ dataFinanceira(periodo.ate) }}
      </p>
      <div class="home-revenue-total">
        <span>Total geral recebido</span
        ><strong class="positive">{{ geral ? moeda(geral.total) : 'Indisponível' }}</strong>
      </div>
      <template v-if="contas.length">
        <label for="home-revenue-account">Consultar uma conta ou caixa</label>
        <select id="home-revenue-account" v-model="contaId" @change="carregarConta">
          <option v-for="conta in contas" :key="conta.id" :value="conta.id">
            {{ conta.nome }}
          </option>
        </select>
        <div class="home-revenue-account" aria-live="polite">
          <p v-if="carregandoConta" role="status">Consultando conta…</p>
          <div v-else-if="erroConta" role="alert">
            <p>{{ erroConta }}</p>
            <button class="retry" @click="carregarConta">Tentar novamente</button>
          </div>
          <template v-else-if="porConta"
            ><span>Recebido nesta conta</span><strong>{{ moeda(porConta.total) }}</strong
            ><small>{{ porConta.quantidade }} receitas no período</small></template
          >
        </div>
      </template>
      <p v-else>
        Nenhuma conta ativa.
        <RouterLink :to="{ path: '/', query: { cadastro: 'banco' } }"
          >Cadastrar conta ou caixa</RouterLink
        >
      </p>
      <RouterLink to="/relatorios/receitas" class="home-section-link"
        >Abrir relatório de receitas <span aria-hidden="true">→</span></RouterLink
      >
    </template>
  </section>
</template>
