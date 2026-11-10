<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { moeda } from '../../services/dashboard'
import { obterAtividades, dataCadastro, type Atividade } from '../../services/atividades'
import { mensagemErro } from '../../services/http'
import { useAuthStore } from '../../stores/auth'
import Icon from './DashboardIcon.vue'

const props = defineProps<{ contaSelecionada: boolean; versao: number }>()
const auth = useAuthStore()
const itens = ref<Atividade[]>([])
const carregando = ref(false)
const erro = ref('')
const lista = ref<HTMLUListElement | null>(null)
let leitura = 0
function rotulo(item: Atividade) {
  if (item.tipo === 'conta') return 'Conta ou caixa cadastrado'
  if (item.tipo === 'receita') return 'Receita cadastrada'
  return item.status === 'paga' ? 'Despesa paga' : 'Despesa cadastrada · pendente'
}
async function carregar() {
  const atual = ++leitura
  carregando.value = true
  erro.value = ''
  itens.value = []
  try {
    const resultado = await obterAtividades(auth.obterToken())
    if (atual !== leitura) return
    itens.value = resultado.itens
    await nextTick()
    lista.value?.scrollTo({ top: 0 })
  } catch (falha) {
    if (atual === leitura) erro.value = mensagemErro(falha)
  } finally {
    if (atual === leitura) carregando.value = false
  }
}
watch(() => props.versao, carregar, { immediate: true })
</script>

<template>
  <section class="panel movements" :aria-busy="carregando">
    <div class="section-heading">
      <div>
        <h2>Atividades recentes</h2>
        <p>Últimas atividades registradas no sistema</p>
        <p v-if="contaSelecionada" class="home-general-note">
          Visão geral · todas as contas/caixas, sem filtro
        </p>
      </div>
      <span v-if="!carregando && !erro" class="badge">{{ itens.length }} atividades</span>
    </div>
    <p v-if="carregando" role="status" class="state-message">Carregando atividades…</p>
    <div v-else-if="erro" role="alert" class="state-message">
      <p>{{ erro }}</p>
      <button v-if="auth.accessToken" class="retry" @click="carregar">Tentar novamente</button>
      <RouterLink v-else to="/login">Entrar novamente</RouterLink>
    </div>
    <p v-else-if="!itens.length" class="state-message">Nenhuma atividade encontrada.</p>
    <ul
      v-else
      ref="lista"
      class="movement-list"
      tabindex="0"
      aria-label="Atividades recentes — lista rolável"
    >
      <li
        v-for="item in itens"
        :key="`${item.tipo}-${item.id}`"
        :class="item.tipo === 'conta' ? 'banco' : item.tipo"
      >
        <span class="icon-box"
          ><Icon
            :name="item.tipo === 'conta' ? 'banco' : item.tipo === 'receita' ? 'entrada' : 'saida'"
        /></span>
        <div class="movement-description">
          <strong>{{ rotulo(item) }}</strong>
          <p>{{ item.tipo === 'conta' ? item.nome : item.descricao }}</p>
          <p>{{ dataCadastro(item.created_at) }}</p>
        </div>
        <strong v-if="item.tipo !== 'conta'" class="movement-value">{{ moeda(item.valor) }}</strong>
      </li>
    </ul>
  </section>
</template>
