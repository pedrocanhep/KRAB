<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  criarConta,
  editarConta,
  type CriarConta,
  type Conta,
  type DadosBancarios,
} from '../../services/contas'
import { mensagemErro } from '../../services/http'
import { useAuthStore } from '../../stores/auth'

const props = defineProps<{ registro?: Conta }>()
const emit = defineEmits<{ salvo: []; ocupado: [valor: boolean] }>()
const auth = useAuthStore()
const nome = ref(props.registro?.nome ?? '')
const tipo = ref<CriarConta['tipo']>(props.registro?.tipo ?? 'corrente')
const saldo = ref('0,00')
const codBanco = ref(props.registro?.cod_banco ?? '')
const agencia = ref(props.registro?.agencia ?? '')
const numConta = ref(props.registro?.num_conta ?? '')
const digito = ref(props.registro?.digito_verificador ?? '')
const valores = () =>
  JSON.stringify([
    nome.value,
    tipo.value,
    saldo.value,
    codBanco.value,
    agencia.value,
    numConta.value,
    digito.value,
  ])
const original = valores()
const enviando = ref(false)
const erro = ref('')
const sucesso = ref('')
const alterado = computed(() => valores() !== original)
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
    const bancarios: DadosBancarios = {
      cod_banco: codBanco.value.trim() || (props.registro ? null : undefined),
      agencia: agencia.value.trim() || (props.registro ? null : undefined),
      num_conta: numConta.value.trim() || (props.registro ? null : undefined),
      digito_verificador: digito.value.trim() || (props.registro ? null : undefined),
    }
    if (props.registro) {
      await editarConta(
        props.registro.id,
        { nome: nome.value.trim(), tipo: tipo.value, ...bancarios },
        auth.obterToken(),
      )
      sucesso.value = 'Conta atualizada com sucesso.'
    } else {
      await criarConta(
        { nome: nome.value.trim(), tipo: tipo.value, saldo_inicial: decimal, ...bancarios },
        auth.obterToken(),
      )
      sucesso.value = 'Conta cadastrada com sucesso.'
      nome.value = ''
      tipo.value = 'corrente'
      saldo.value = '0,00'
      codBanco.value = agencia.value = numConta.value = digito.value = ''
    }
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
    <fieldset :disabled="enviando || Boolean(registro?.deleted_at)">
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
      <label v-if="!registro"
        >Saldo inicial (R$)<input v-model="saldo" required inputmode="decimal"
      /></label>
      <details>
        <summary>Dados bancários opcionais</summary>
        <div class="optional-fields">
          <label
            >Código do banco<input
              v-model="codBanco"
              inputmode="numeric"
              pattern="[0-9]{1,4}"
              maxlength="4"
          /></label>
          <label
            >Agência<input v-model="agencia" inputmode="numeric" pattern="[0-9]{1,5}" maxlength="5"
          /></label>
          <label
            >Número da conta<input
              v-model="numConta"
              inputmode="numeric"
              pattern="[0-9]{1,15}"
              maxlength="15"
          /></label>
          <label
            >Dígito verificador<input v-model="digito" pattern="[0-9A-Za-z]{1,2}" maxlength="2"
          /></label>
        </div>
      </details>
      <button class="submit-button" :disabled="enviando || !auth.accessToken">
        {{ enviando ? 'Salvando…' : registro ? 'Salvar alterações' : 'Cadastrar conta' }}
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
