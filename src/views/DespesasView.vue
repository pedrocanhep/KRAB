<script setup lang="ts">
import { ref } from 'vue'

const descricao = ref('')
const valor = ref<number | null>(null)
const vencimento = ref('')
const categoria = ref('')

function cadastrarDespesa() {
  // AQUI ADICIONAR A LÓGICA DE CADASTRO DE DESPESA
  console.log('Despesa cadastrada:', {
    descricao: descricao.value,
    valor: valor.value,
    vencimento: vencimento.value,
    categoria: categoria.value,
  })

  // LIMPA OS CAMPOS APÓS O CADASTRO
  // descricao.value = ''
  // valor.value = null
  // vencimento.value = ''
  // categoria.value = ''
}
</script>

<template>
  <main>
    <h1>Cadastrar despesa</h1>

    <form @submit.prevent="cadastrarDespesa">
      <div>
        <label for="descricao">Descrição</label>
        <input id="descricao" v-model="descricao" type="text" />
      </div>

      <div>
        <label for="valor">Valor</label>
        <input id="valor" v-model.number="valor" type="number" step="0.01" />
      </div>

      <div>
        <label for="vencimento">Vencimento</label>
        <input id="vencimento" v-model="vencimento" type="date" />
      </div>

      <div>
        <label for="categoria">Categoria</label>
        <input id="categoria" v-model="categoria" type="text" />
      </div>

      <button type="submit">Cadastrar despesa</button>
    </form>
  </main>
</template>
