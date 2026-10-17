<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { criarDespesa, obterPrimeiraContaAtiva } from '../../services/despesas'
import { criarReceita } from '../../services/receitas'
import { mensagemErro } from '../../services/http'

const props = defineProps<{ tipo: 'receita' | 'despesa' }>()
const emit = defineEmits<{ salvo: []; ocupado: [valor: boolean] }>()
const auth = useAuthStore()
const descricao = ref('')
const valor = ref('')
const data = ref('')
const categoria = ref('')
const enviando = ref(false)
const erro = ref('')
const sucesso = ref('')
const alterado = computed(() =>
  Boolean(descricao.value || valor.value || data.value || categoria.value),
)
defineExpose({ alterado, enviando })

// O mesmo formulário atende a rota antiga e o drawer. A conta continua sendo
// a primeira ativa, obtida novamente em cada envio, inclusive após criar banco.
async function salvar() {
  if (enviando.value) return
  erro.value = ''
  sucesso.value = ''
  enviando.value = true
  emit('ocupado', true)
  try {
    const decimal = valor.value.trim().replace(',', '.')
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(decimal) || Number(decimal) <= 0) {
      throw new Error('Informe um valor maior que zero, com até duas casas decimais.')
    }
    const token = auth.obterToken()
    const contaId = await obterPrimeiraContaAtiva(token)
    const campos = {
      conta_id: contaId,
      descricao: descricao.value.trim(),
      valor: decimal,
      categoria: categoria.value.trim(),
    }
    if (props.tipo === 'despesa') {
      await criarDespesa({ ...campos, data_vencimento: data.value }, token)
      sucesso.value =
        'Despesa cadastrada com sucesso. Ela aparecerá em “Movimentações recentes” após o pagamento.'
    } else {
      await criarReceita({ ...campos, data_recebimento: data.value }, token)
      sucesso.value = 'Receita cadastrada com sucesso.'
    }
    // Só descartamos campos após confirmação do POST. A view atualiza o GET
    // separadamente, para uma falha de leitura não parecer falha no cadastro.
    descricao.value = valor.value = data.value = categoria.value = ''
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
    <p class="form-hint">
      O lançamento será vinculado automaticamente à primeira conta ativa, em ordem alfabética.
    </p>
    <fieldset :disabled="enviando">
      <label
        >Descrição<input
          v-model="descricao"
          required
          maxlength="100"
          autocomplete="off"
          placeholder="Ex.: serviços do mês"
      /></label>
      <label
        >Valor (R$)<input v-model="valor" required inputmode="decimal" placeholder="0,00"
      /></label>
      <label
        >{{ tipo === 'despesa' ? 'Vencimento' : 'Data de recebimento'
        }}<input v-model="data" required type="date"
      /></label>
      <label
        >Categoria<input v-model="categoria" required maxlength="50" placeholder="Ex.: serviços"
      /></label>
      <button class="submit-button" :disabled="enviando || !auth.accessToken">
        {{ enviando ? 'Salvando…' : `Cadastrar ${tipo}` }}
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
