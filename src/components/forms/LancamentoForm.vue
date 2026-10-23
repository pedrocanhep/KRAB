<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { criarDespesa, editarDespesa, type Despesa } from '../../services/despesas'
import { criarReceita, editarReceita, type Receita } from '../../services/receitas'
import { mensagemErro } from '../../services/http'

import { todasContas, type Conta } from '../../services/contas'

const props = defineProps<{ tipo: 'receita' | 'despesa'; registro?: Receita | Despesa }>()
const emit = defineEmits<{ salvo: []; ocupado: [valor: boolean] }>()
const auth = useAuthStore()
const contas = ref<Conta[]>([])
const contaId = ref(props.registro?.conta_id ?? '')
const carregandoContas = ref(true)
const erroContas = ref('')
async function carregarContas() {
  carregandoContas.value = true
  erroContas.value = ''
  try {
    contas.value = await todasContas(auth.obterToken())
    if (!contaId.value) contaId.value = contas.value[0]?.id ?? ''
  } catch (falha) {
    erroContas.value = mensagemErro(falha)
  } finally {
    carregandoContas.value = false
  }
}
onMounted(carregarContas)
const descricao = ref(props.registro?.descricao ?? '')
const valor = ref(props.registro ? String(props.registro.valor).replace('.', ',') : '')
const data = ref(
  props.registro
    ? 'data_vencimento' in props.registro
      ? props.registro.data_vencimento
      : props.registro.data_recebimento
    : '',
)
const categoria = ref(props.registro?.categoria ?? '')
const enviando = ref(false)
const erro = ref('')
const sucesso = ref('')
const alterado = computed(() =>
  Boolean(descricao.value || valor.value || data.value || categoria.value),
)
defineExpose({ alterado, enviando })

// Cadastro e edição usam os mesmos campos e os contratos existentes da API.
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
    if (!contaId.value) throw new Error('Cadastre uma conta antes de registrar o lançamento.')
    const campos = {
      conta_id: contaId.value,
      descricao: descricao.value.trim(),
      valor: decimal,
      categoria: categoria.value.trim(),
    }
    const { conta_id: conta, ...editaveis } = campos
    if (props.tipo === 'despesa') {
      const payload = { ...editaveis, data_vencimento: data.value }
      if (props.registro) await editarDespesa(props.registro.id, payload, token)
      else await criarDespesa({ ...payload, conta_id: conta }, token)
      sucesso.value = props.registro
        ? 'Despesa atualizada com sucesso.'
        : 'Despesa cadastrada. O saldo será atualizado após o pagamento.'
    } else {
      const payload = { ...editaveis, data_recebimento: data.value }
      if (props.registro) await editarReceita(props.registro.id, payload, token)
      else await criarReceita({ ...payload, conta_id: conta }, token)
      sucesso.value = props.registro
        ? 'Receita atualizada com sucesso.'
        : 'Receita cadastrada com sucesso.'
    }
    // Só descartamos campos após confirmação do POST. A view atualiza o GET
    // separadamente, para uma falha de leitura não parecer falha no cadastro.
    if (!props.registro) descricao.value = valor.value = data.value = categoria.value = ''
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
    <p v-if="carregandoContas" role="status">Carregando contas…</p>
    <div v-else-if="erroContas" role="alert">
      <p>{{ erroContas }}</p>
      <button type="button" class="retry" @click="carregarContas">Tentar novamente</button>
    </div>
    <p v-else-if="!contas.length" class="form-hint">
      Cadastre uma conta antes de registrar lançamentos.
      <RouterLink :to="{ path: '/', query: { cadastro: 'banco' } }">Cadastrar conta</RouterLink>
    </p>
    <fieldset :disabled="enviando || carregandoContas || Boolean(erroContas) || !contas.length">
      <label
        >Conta<select v-model="contaId" required :disabled="Boolean(registro)">
          <option v-for="conta in contas" :key="conta.id" :value="conta.id">
            {{ conta.nome }}
          </option>
        </select></label
      >
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
        {{ enviando ? 'Salvando…' : registro ? 'Salvar alterações' : `Cadastrar ${tipo}` }}
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
