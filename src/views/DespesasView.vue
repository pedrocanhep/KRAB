<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { listarDespesas, type Despesa } from '../services/despesas'

import LancamentoForm from '../components/forms/LancamentoForm.vue'

const enviando = ref(false)
const auth = useAuthStore()

// A tabela guarda apenas registros recebidos pelo GET, nunca um cadastro local.
const despesas = ref<Despesa[]>([])
const carregandoDespesas = ref(false)
const erroListagem = ref('')
// Evita mostrar "nenhuma despesa" antes de ocorrer uma consulta bem-sucedida.
const listagemCarregada = ref(false)

// Chamada apenas pelo botão ou após sucesso do cadastro: não há consulta ao montar.
// O catch próprio impede que uma falha no GET seja tratada como falha do POST.
async function carregarDespesas() {
  if (carregandoDespesas.value) return
  carregandoDespesas.value = true
  erroListagem.value = ''

  try {
    const resposta = await listarDespesas(auth.obterToken())
    despesas.value = resposta.itens
    listagemCarregada.value = true
  } catch (erro) {
    erroListagem.value =
      erro instanceof TypeError
        ? 'Não foi possível carregar despesas. Verifique o backend e o CORS.'
        : erro instanceof Error
          ? erro.message
          : 'Não foi possível carregar despesas.'
  } finally {
    carregandoDespesas.value = false
  }
}
</script>

<template>
  <main>
    <h1>Cadastrar despesa</h1>
    <!-- Em 401 mantemos o formulário e oferecemos uma ação explícita de novo login. -->
    <RouterLink v-if="!auth.accessToken" to="/login">Entrar novamente</RouterLink>

    <LancamentoForm tipo="despesa" @salvo="carregarDespesas" @ocupado="enviando = $event" />

    <h2>Despesas cadastradas</h2>
    <button type="button" :disabled="carregandoDespesas || enviando" @click="carregarDespesas">
      Carregar despesas
    </button>
    <p v-if="erroListagem" role="status">{{ erroListagem }}</p>
    <p v-else-if="listagemCarregada && despesas.length === 0">Nenhuma despesa encontrada.</p>

    <table v-if="despesas.length > 0">
      <thead>
        <tr>
          <th scope="col">Descrição</th>
          <th scope="col">Valor</th>
          <th scope="col">Vencimento</th>
          <th scope="col">Categoria</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="despesa in despesas" :key="despesa.id">
          <td>{{ despesa.descricao }}</td>
          <td>{{ despesa.valor }}</td>
          <td>{{ despesa.data_vencimento }}</td>
          <td>{{ despesa.categoria }}</td>
          <td>{{ despesa.status }}</td>
        </tr>
      </tbody>
    </table>
  </main>
</template>
