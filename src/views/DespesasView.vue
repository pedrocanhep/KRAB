<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import {
  criarDespesa,
  listarDespesas,
  obterPrimeiraContaAtiva,
  type Despesa,
} from '../services/despesas'

const auth = useAuthStore()

// Estados locais ligados aos campos do formulário por v-model.
const descricao = ref('')
// Mantemos o valor como texto para enviar o decimal sem arredondamento.
const valor = ref('')
const vencimento = ref('')
const categoria = ref('')
// Feedback e bloqueio de envio pertencem ao cadastro, não à listagem.
const mensagem = ref('')
const enviando = ref(false)

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

// Coordena tela → service → backend. Só limpa os campos depois do POST confirmado.
async function cadastrarDespesa() {
  if (enviando.value) return
  enviando.value = true
  mensagem.value = ''

  try {
    // Checagem mínima do contrato decimal; Number é usado apenas para testar > 0.
    // O valor enviado continua sendo a string original, sem conversão ou arredondamento.
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(valor.value) || Number(valor.value) <= 0) {
      throw new Error(
        'Informe um valor maior que zero, com ponto e até duas casas decimais (10.50).',
      )
    }
    // O token vem da sessão em memória. Primeiro buscamos as contas do usuário;
    // a API ordena por nome e usamos itens[0].id, sem seleção nesta etapa.
    const token = auth.obterToken()
    const contaId = await obterPrimeiraContaAtiva(token)
    await criarDespesa(
      {
        descricao: descricao.value,
        valor: valor.value,
        // A tela chama o campo de vencimento; a API espera data_vencimento.
        data_vencimento: vencimento.value,
        categoria: categoria.value,
        conta_id: contaId,
      },
      token,
    )
    mensagem.value = 'Despesa cadastrada com sucesso.'
    descricao.value = ''
    valor.value = ''
    vencimento.value = ''
    categoria.value = ''
    // Uma nova leitura confirma visualmente o que foi persistido no backend.
    // Seu erro é exibido separadamente, preservando a mensagem de cadastro concluído.
    await carregarDespesas()
  } catch (erro) {
    mensagem.value =
      erro instanceof TypeError
        ? 'Não foi possível conectar à API. Verifique o backend e o CORS.'
        : erro instanceof Error
          ? erro.message
          : 'Não foi possível cadastrar a despesa.'
  } finally {
    // Libera o botão tanto em sucesso quanto em erro, permitindo outra tentativa.
    enviando.value = false
  }
}
</script>

<template>
  <main>
    <h1>Cadastrar despesa</h1>
    <!-- Em 401 mantemos o formulário e oferecemos uma ação explícita de novo login. -->
    <RouterLink v-if="!auth.accessToken" to="/login">Entrar novamente</RouterLink>

    <form @submit.prevent="cadastrarDespesa">
      <div>
        <label for="descricao">Descrição</label>
        <input id="descricao" v-model="descricao" type="text" />
      </div>

      <div>
        <label for="valor">Valor</label>
        <input id="valor" v-model="valor" type="text" inputmode="decimal" />
      </div>

      <div>
        <label for="vencimento">Vencimento</label>
        <input id="vencimento" v-model="vencimento" type="date" />
      </div>

      <div>
        <label for="categoria">Categoria</label>
        <input id="categoria" v-model="categoria" type="text" />
      </div>

      <button type="submit" :disabled="enviando">Cadastrar despesa</button>
    </form>
    <p v-if="mensagem" role="status">{{ mensagem }}</p>

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
