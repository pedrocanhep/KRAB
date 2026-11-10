<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { obterAtividades, dataCadastro, type Atividade } from '../services/atividades'
import { moeda } from '../services/dashboard'
import { mensagemErro } from '../services/http'
import { useAuthStore } from '../stores/auth'
import '../assets/dashboard.css'
const auth = useAuthStore()
const itens = ref<Atividade[]>([])
const carregando = ref(false)
const erro = ref('')
async function carregar() {
  if (carregando.value) return
  carregando.value = true
  erro.value = ''
  try {
    itens.value = (await obterAtividades(auth.obterToken())).itens
  } catch (falha) {
    itens.value = []
    erro.value = mensagemErro(falha)
  } finally {
    carregando.value = false
  }
}
void carregar()
</script>
<template>
  <div class="dashboard-shell">
    <main class="dashboard-main">
      <RouterLink to="/">← Voltar ao início</RouterLink>
      <h1>Atividades de cadastro</h1>
      <section class="panel">
        <p>
          Até oito receitas, despesas e contas cadastradas recentemente. Inclui despesas pendentes e
          não representa entrada ou saída efetiva de dinheiro.
        </p>
        <button class="retry" :disabled="carregando" @click="carregar">Atualizar atividades</button>
        <p v-if="carregando" role="status">Carregando atividades…</p>
        <p v-else-if="erro" class="form-error" role="alert">{{ erro }}</p>
        <p v-else-if="!itens.length" class="state-message">Nenhuma atividade encontrada.</p>
        <ul v-else class="activity-list">
          <li v-for="item in itens" :key="`${item.tipo}-${item.id}`">
            <strong>{{ item.tipo === 'conta' ? item.nome : item.descricao }}</strong>
            <p>
              {{ dataCadastro(item.created_at) }} •
              {{
                item.tipo === 'conta'
                  ? 'Conta cadastrada'
                  : item.tipo === 'receita'
                    ? 'Receita cadastrada'
                    : item.status === 'paga'
                      ? 'Despesa paga'
                      : 'Despesa pendente'
              }}<span v-if="item.tipo !== 'conta'"> • {{ moeda(item.valor) }}</span>
            </p>
          </li>
        </ul>
        <RouterLink v-if="!auth.accessToken" to="/login">Entrar novamente</RouterLink>
      </section>
    </main>
  </div>
</template>
