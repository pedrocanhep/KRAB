<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { criarConta, type CriarConta } from '../../services/contas'
import { mensagemErro } from '../../services/http'
import { useAuthStore } from '../../stores/auth'

const emit = defineEmits<{ salvo: []; ocupado: [valor: boolean] }>()
const auth = useAuthStore()
const nome = ref('')
const tipo = ref<CriarConta['tipo']>('corrente')
const saldo = ref('0,00')
const enviando = ref(false)
const erro = ref('')
const sucesso = ref('')
const alterado = computed(() =>
  Boolean(nome.value || tipo.value !== 'corrente' || saldo.value !== '0,00'),
)
defineExpose({ alterado, enviando })

async function salvar() {
  if (enviando.value) return
  enviando.value = true
  emit('ocupado', true)
  erro.value = sucesso.value = ''
  try {
    // O contrato permite saldo inicial negativo. Preservamos o decimal em texto.
    const decimal = saldo.value.trim().replace(',', '.')
    if (!/^-?\d{1,12}(\.\d{1,2})?$/.test(decimal))
      throw new Error('Informe um saldo com até duas casas decimais.')
    await criarConta(
      { nome: nome.value.trim(), tipo: tipo.value, saldo_inicial: decimal },
      auth.obterToken(),
    )
    sucesso.value = 'Conta cadastrada com sucesso. Ela já está disponível para novos lançamentos.'
    nome.value = ''
    tipo.value = 'corrente'
    saldo.value = '0,00'
    emit('salvo')
  } catch (falha) {
    erro.value = mensagemErro(falha)
  } finally {
    enviando.value = false
    emit('ocupado', false)
  }
}
</script>

<template>
  <form class="cadastro-form" @submit.prevent="salvar">
    <p class="form-hint">Cadastre a conta onde você guarda seu dinheiro.</p>
    <fieldset :disabled="enviando">
      <label
        >Nome da conta<input
          v-model="nome"
          required
          maxlength="50"
          placeholder="Ex.: conta principal"
      /></label>
      <label
        >Tipo de conta<select v-model="tipo">
          <option value="corrente">Conta corrente</option>
          <option value="poupanca">Poupança</option>
          <option value="caixa">Caixa</option>
          <option value="outro">Outro</option>
        </select></label
      >
      <label>Saldo inicial (R$)<input v-model="saldo" required inputmode="decimal" /></label>
      <button class="submit-button" :disabled="enviando || !auth.accessToken">
        {{ enviando ? 'Salvando…' : 'Cadastrar banco' }}
      </button>
    </fieldset>
    <p v-if="erro" class="form-error" role="alert">{{ erro }}</p>
    <p v-if="sucesso" class="form-success" role="status">{{ sucesso }}</p>
    <RouterLink v-if="!auth.accessToken" to="/login">Entrar novamente</RouterLink>
  </form>
</template>

<style scoped>
@import '../../assets/forms.css';
</style>
