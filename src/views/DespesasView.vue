<script setup lang="ts">
import { ref } from 'vue'

const descricao = ref('')
const valor = ref<number | null>(null)
const vencimento = ref('')
const categoria = ref('')
</script>

<template>
  <main>
    <h1>Cadastrar despesa</h1>

    <form>
      <div>
        <label for="descricao">Descrição</label>
        <input id="descricao" type="text" />
      </div>

      <div>
        <label for="valor">Valor</label>
        <input id="valor" type="number" step="0.01" />
      </div>

      <div>
        <label for="vencimento">Vencimento</label>
        <input id="vencimento" type="date" />
      </div>

      <div>
        <label for="categoria">Categoria</label>
        <input id="categoria" type="text" />
      </div>

      <button type="submit">Cadastrar despesa</button>
    </form>
  </main>
</template>
