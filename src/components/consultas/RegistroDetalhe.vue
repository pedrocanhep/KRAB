<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import {
  obterConta,
  nomesTipoConta,
  type DetalheConta,
  type EventoSaldo,
} from '../../services/contas'
import { obterReceita, type DetalheReceita } from '../../services/receitas'
import { obterDespesa, type DetalheDespesa } from '../../services/despesas'
import { moeda, dataFinanceira, dataHora } from '../../services/dashboard'
import { mensagemErro } from '../../services/http'
import { useAuthStore } from '../../stores/auth'

const props = defineProps<{ dominio: 'conta' | 'receita' | 'despesa'; id: string }>()
const auth = useAuthStore()
// Interface reservada para a segunda etapa; a consulta e a implementação permanecem.
const mostrarHistoricoSaldo = false
const detalhe = ref<DetalheConta | DetalheReceita | DetalheDespesa | null>(null)
const carregando = ref(true)
const erro = ref('')
let consulta = 0
async function carregar() {
  const atual = ++consulta
  carregando.value = true
  erro.value = ''
  detalhe.value = null
  try {
    const token = auth.obterToken()
    const dados =
      props.dominio === 'conta'
        ? await obterConta(props.id, token)
        : props.dominio === 'receita'
          ? await obterReceita(props.id, token)
          : await obterDespesa(props.id, token)
    if (atual === consulta) detalhe.value = dados
  } catch (falha) {
    if (atual === consulta) erro.value = mensagemErro(falha)
  } finally {
    if (atual === consulta) carregando.value = false
  }
}
const linhas = computed(() => {
  const d = detalhe.value
  if (!d) return []
  const comuns = [
    ['Situação', d.deleted_at ? 'Excluído' : 'Ativo'],
    ['Criado em', dataHora(d.created_at)],
    ['Atualizado em', dataHora(d.updated_at)],
  ]
  if ('nome' in d)
    return [
      ['Nome', d.nome],
      ['Tipo', nomesTipoConta[d.tipo]],
      ['Saldo disponível', moeda(d.saldo_disponivel)],
      ['Código do banco', d.cod_banco || 'Não informado'],
      ['Agência', d.agencia || 'Não informada'],
      ['Número da conta', d.num_conta || 'Não informado'],
      ['Dígito verificador', d.digito_verificador || 'Não informado'],
      ...comuns,
    ]
  return [
    ['Descrição', d.descricao],
    ['Conta (identificador)', d.conta_id],
    ['Valor', moeda(d.valor)],
    ['Categoria', d.categoria],
    ...('data_recebimento' in d
      ? [['Recebimento', dataFinanceira(d.data_recebimento)]]
      : [
          ['Vencimento', dataFinanceira(d.data_vencimento)],
          ['Status', d.status === 'paga' ? 'Paga' : 'Pendente'],
          ['Pagamento', d.data_pagamento ? dataFinanceira(d.data_pagamento) : 'Não pago'],
          ['Valor pago', d.valor_pago === null ? 'Não pago' : moeda(d.valor_pago)],
        ]),
    ...comuns,
  ]
})
const eventos = computed<EventoSaldo[]>(() =>
  detalhe.value
    ? 'ultimas_movimentacoes' in detalhe.value
      ? detalhe.value.ultimas_movimentacoes
      : detalhe.value.historico
    : [],
)
watch(() => [props.id, props.dominio], carregar, { immediate: true })
</script>

<template>
  <div :aria-busy="carregando">
    <p v-if="carregando" role="status">Carregando detalhes…</p>
    <div v-else-if="erro" class="form-error" role="alert">
      <p>{{ erro }}</p>
      <button class="retry" @click="carregar">Tentar novamente</button>
    </div>
    <template v-else-if="detalhe">
      <dl class="detail-fields">
        <div v-for="[rotulo, valor] in linhas" :key="rotulo">
          <dt>{{ rotulo }}</dt>
          <dd>{{ valor }}</dd>
        </div>
      </dl>
      <template v-if="mostrarHistoricoSaldo">
        <h3>
          {{
            dominio === 'conta' ? 'Últimos 20 eventos de saldo' : 'Histórico de alterações do saldo'
          }}
        </h3>
        <p class="form-hint">
          Eventos de criação, pagamento, ajustes e estornos. Esta consulta não é o extrato de
          lançamentos atuais.
        </p>
        <p v-if="!eventos.length" class="state-message">Nenhum evento financeiro registrado.</p>
        <div v-else class="table-scroll" tabindex="0" aria-label="Histórico com rolagem horizontal">
          <table>
            <thead>
              <tr>
                <th>Data do evento</th>
                <th>Origem</th>
                <th>Motivo</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="evento in eventos" :key="evento.id">
                <td>{{ dataHora(evento.created_at) }}</td>
                <td>{{ evento.origem_tipo ?? dominio }}</td>
                <td>{{ evento.motivo }}</td>
                <td :class="evento.valor < 0 ? 'negative' : 'positive'">
                  {{ moeda(evento.valor) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>
    <RouterLink v-if="!auth.accessToken" to="/login">Entrar novamente</RouterLink>
  </div>
</template>
