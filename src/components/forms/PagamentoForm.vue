<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { pagarDespesa, type Despesa, type ResultadoDespesa } from '../../services/despesas'
import { hojeSaoPaulo, moeda } from '../../services/dashboard'
import { mensagemErro } from '../../services/http'
import { useAuthStore } from '../../stores/auth'
const props = defineProps<{ despesa: Despesa }>()
const emit = defineEmits<{ ocupado: [valor: boolean]; salvo: [resultado: ResultadoDespesa] }>()
const auth = useAuthStore()
const data = ref(hojeSaoPaulo())
const enviando = ref(false)
const erro = ref('')
async function pagar() {
  if (enviando.value) return
  erro.value = ''
  if (!data.value || data.value > hojeSaoPaulo()) {
    erro.value = 'Informe uma data de pagamento até hoje.'
    return
  }
  if (
    !window.confirm(
      `Confirmar o pagamento integral de ${moeda(props.despesa.valor)} em ${data.value}?`,
    )
  )
    return
  enviando.value = true
  emit('ocupado', true)
  try {
    const resultado = await pagarDespesa(props.despesa.id, auth.obterToken(), data.value)
    emit('salvo', resultado)
  } catch (falha) {
    erro.value = mensagemErro(falha)
  } finally {
    enviando.value = false
    emit('ocupado', false)
  }
}
</script>
<template>
  <form class="cadastro-form" @submit.prevent="pagar">
    <p>{{ despesa.descricao }} — {{ moeda(despesa.valor) }}</p>
    <fieldset :disabled="enviando">
      <label
        >Data do pagamento<input v-model="data" type="date" :max="hojeSaoPaulo()" required
      /></label>
      <button type="button" class="retry" @click="data = hojeSaoPaulo()">Usar hoje</button>
      <button class="submit-button" :disabled="!auth.accessToken">
        {{ enviando ? 'Registrando…' : 'Confirmar pagamento' }}
      </button>
    </fieldset>
    <p v-if="erro" class="form-error" role="alert">{{ erro }}</p>
    <RouterLink v-if="!auth.accessToken" to="/login">Entrar novamente</RouterLink>
  </form>
</template>
