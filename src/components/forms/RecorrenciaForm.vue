<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  criarRecorrencia,
  editarRecorrencia,
  frequencias,
  type Recorrencia,
  type CriarRecorrencia,
} from '../../services/recorrencias'
import { todasContas, type Conta } from '../../services/contas'
import { hojeSaoPaulo } from '../../services/dashboard'
import { mensagemErro } from '../../services/http'
import { useAuthStore } from '../../stores/auth'
const props = defineProps<{ registro?: Recorrencia }>()
const emit = defineEmits<{ ocupado: [valor: boolean]; salvo: [quantidade: number] }>()
const auth = useAuthStore()
const contas = ref<Conta[]>([])
const carregando = ref(true)
const erroContas = ref('')
const erro = ref('')
const enviando = ref(false)
const contaId = ref(props.registro?.conta_id ?? '')
const descricao = ref(props.registro?.descricao ?? '')
const valor = ref(props.registro ? String(props.registro.valor).replace('.', ',') : '')
const categoria = ref(props.registro?.categoria ?? '')
const frequencia = ref<CriarRecorrencia['frequencia']>(props.registro?.frequencia ?? 'mensal')
const inicio = ref(props.registro?.data_inicio ?? hojeSaoPaulo())
const fim = ref(props.registro?.data_fim ?? '')
const valores = () =>
  JSON.stringify([
    contaId.value,
    descricao.value,
    valor.value,
    categoria.value,
    frequencia.value,
    inicio.value,
    fim.value,
  ])
let original = valores()
const contaOriginalAusente = computed(() =>
  Boolean(props.registro && !contas.value.some((c) => c.id === props.registro?.conta_id)),
)
const alterado = computed(() => valores() !== original)
defineExpose({ alterado })
async function carregarContas() {
  carregando.value = true
  erroContas.value = ''
  try {
    contas.value = await todasContas(auth.obterToken())
    if (!contaId.value) {
      contaId.value = contas.value[0]?.id ?? ''
      if (!props.registro) original = valores()
    }
  } catch (falha) {
    erroContas.value = mensagemErro(falha)
  } finally {
    carregando.value = false
  }
}
async function salvar() {
  if (enviando.value) return
  erro.value = ''
  const decimal = valor.value.trim().replace(',', '.')
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(decimal) || Number(decimal) <= 0) {
    erro.value = 'Informe um valor positivo com até duas casas decimais.'
    return
  }
  if (fim.value && fim.value < inicio.value) {
    erro.value = 'A data final deve ser igual ou posterior à inicial.'
    return
  }
  if (!contas.value.some((c) => c.id === contaId.value)) {
    erro.value = 'Selecione uma conta ativa.'
    return
  }
  enviando.value = true
  emit('ocupado', true)
  try {
    const campos = {
      conta_id: contaId.value,
      descricao: descricao.value.trim(),
      valor: decimal,
      categoria: categoria.value.trim(),
    }
    const resultado = props.registro
      ? await editarRecorrencia(
          props.registro.id,
          { ...campos, data_fim: fim.value || null },
          auth.obterToken(),
        )
      : await criarRecorrencia(
          {
            ...campos,
            frequencia: frequencia.value,
            data_inicio: inicio.value,
            ...(fim.value ? { data_fim: fim.value } : {}),
          },
          auth.obterToken(),
        )
    emit('salvo', resultado.ocorrencias_geradas)
  } catch (falha) {
    erro.value = mensagemErro(falha)
  } finally {
    enviando.value = false
    emit('ocupado', false)
  }
}
onMounted(carregarContas)
</script>
<template>
  <form class="cadastro-form" @submit.prevent="salvar">
    <p class="form-hint">
      As ocorrências são despesas pendentes; o saldo só muda quando forem pagas. A criação aceita
      início até 31 dias atrás.
    </p>
    <p v-if="carregando" role="status">Carregando contas…</p>
    <div v-if="erroContas" class="form-error" role="alert">
      <p>{{ erroContas }}</p>
      <button type="button" class="retry" @click="carregarContas">Tentar novamente</button>
    </div>
    <p v-if="!carregando && !erroContas && !contas.length">
      Cadastre ou restaure uma conta em <RouterLink to="/contas">Contas e caixas</RouterLink>.
    </p>
    <fieldset :disabled="enviando || carregando || Boolean(erroContas) || !contas.length">
      <label
        >Conta<select v-model="contaId" required>
          <option v-if="registro && contaOriginalAusente" :value="registro.conta_id" disabled>
            Conta excluída — selecione outra ou restaure a conta
          </option>
          <option v-for="conta in contas" :key="conta.id" :value="conta.id">
            {{ conta.nome }}
          </option>
        </select></label
      >
      <label>Descrição<input v-model="descricao" maxlength="100" required /></label>
      <label>Valor (R$)<input v-model="valor" inputmode="decimal" required /></label>
      <label>Categoria<input v-model="categoria" maxlength="50" required /></label>
      <label
        >Frequência<select v-model="frequencia" :disabled="Boolean(registro)">
          <option v-for="(nome, codigo) in frequencias" :key="codigo" :value="codigo">
            {{ nome }}
          </option>
        </select></label
      >
      <label
        >Data inicial<input v-model="inicio" type="date" :disabled="Boolean(registro)" required
      /></label>
      <label>Data final (opcional)<input v-model="fim" type="date" :min="inicio" /></label>
      <p v-if="registro" class="form-hint">
        Frequência e início não mudam. Alterações afetam pendentes de hoje em diante. Encurtar o fim
        cancela ocorrências posteriores; ampliá-lo não recupera as já excluídas.
      </p>
      <button class="submit-button" :disabled="!auth.accessToken">
        {{ enviando ? 'Salvando…' : registro ? 'Salvar alterações' : 'Criar recorrência' }}
      </button>
    </fieldset>
    <p v-if="erro" class="form-error" role="alert">{{ erro }}</p>
    <RouterLink v-if="!auth.accessToken" to="/login">Entrar novamente</RouterLink>
  </form>
</template>
