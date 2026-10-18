<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { moeda } from '../../services/dashboard'
import { dataCadastro, type Atividade } from '../../services/atividades'
import Icon from './DashboardIcon.vue'
const props = defineProps<{
  itens: Atividade[]
  carregando: boolean
  erro: string
  autenticado: boolean
}>()
defineEmits<{ tentar: [] }>()

const lista = ref<HTMLUListElement | null>(null)
const alturaLista = ref<string>()
let frameMedicao = 0
// Medir no próximo frame evita alterar a altura durante a notificação de resize.
const observador = new ResizeObserver(() => {
  cancelAnimationFrame(frameMedicao)
  frameMedicao = requestAnimationFrame(atualizarAltura)
})

// Medimos os itens reais para manter cinco completos e metade do sexto mesmo
// com descrições longas, status ou quebra de linha no celular. Sem sexto item,
// a lista usa sua altura natural, sem reservar espaço para registros ausentes.
function atualizarAltura() {
  const primeiro = lista.value?.children[0]
  const sexto = lista.value?.children[5]
  alturaLista.value =
    primeiro && sexto
      ? `${sexto.getBoundingClientRect().top - primeiro.getBoundingClientRect().top + sexto.getBoundingClientRect().height / 2}px`
      : undefined
}

watch(
  [lista, () => props.itens],
  async () => {
    await nextTick()
    observador.disconnect()
    if (lista.value) {
      observador.observe(lista.value)
      for (const item of lista.value.children) observador.observe(item)
    }
    atualizarAltura()
  },
  { flush: 'post' },
)
onUnmounted(() => {
  observador.disconnect()
  cancelAnimationFrame(frameMedicao)
})
</script>

<template>
  <section class="panel movements" :aria-busy="carregando">
    <div class="section-heading">
      <div>
        <h2>Atividades recentes</h2>
        <p>Últimos cadastros e lançamentos registrados</p>
      </div>
      <span v-if="!carregando && !erro" class="badge">{{ itens.length }} atividades</span>
    </div>
    <p v-if="carregando" role="status" class="state-message">Carregando atividades…</p>
    <div v-else-if="erro" role="alert" class="state-message">
      <p>{{ erro }}</p>
      <button v-if="autenticado" class="retry" @click="$emit('tentar')">Tentar novamente</button
      ><RouterLink v-else to="/login">Entrar novamente</RouterLink>
    </div>
    <p v-else-if="!itens.length" class="state-message">Nenhuma atividade registrada ainda.</p>
    <ul
      v-else
      ref="lista"
      class="movement-list"
      :style="{ maxHeight: alturaLista }"
      :tabindex="itens.length > 5 ? 0 : undefined"
      aria-label="Atividades recentes — lista rolável"
    >
      <li
        v-for="item in itens"
        :key="`${item.tipo}-${item.id}`"
        :class="item.tipo === 'conta' ? 'banco' : item.tipo"
      >
        <span class="icon-box"
          ><Icon
            :name="item.tipo === 'conta' ? 'banco' : item.tipo === 'receita' ? 'entrada' : 'saida'"
        /></span>
        <div class="movement-description">
          <strong>{{ item.tipo === 'conta' ? item.nome : item.descricao }}</strong>
          <p>
            {{
              item.tipo === 'conta'
                ? 'Conta cadastrada'
                : item.tipo === 'receita'
                  ? 'Receita'
                  : 'Despesa'
            }}<template v-if="item.tipo === 'despesa'">
              • {{ item.status === 'pendente' ? 'Pendente' : 'Paga' }}</template
            >
            • {{ dataCadastro(item.created_at) }}
          </p>
        </div>
        <strong v-if="item.tipo !== 'conta'" class="movement-value"
          >{{ item.tipo === 'receita' ? '+' : '-' }} {{ moeda(Math.abs(item.valor)) }}</strong
        >
      </li>
    </ul>
  </section>
</template>
