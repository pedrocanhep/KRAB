<script lang="ts">
// O lock é compartilhado para que a troca de painéis não restaure o scroll cedo demais.
let paineisAbertos = 0
let overflowOriginal = ''
</script>
<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, useId } from 'vue'
import Icon from './DashboardIcon.vue'
const props = defineProps<{ titulo: string; ocupado: boolean; subtitulo?: string }>()
const emit = defineEmits<{ fechar: [] }>()
const painel = ref<HTMLElement>()
const tituloId = useId()
const focoAnterior = document.activeElement as HTMLElement | null
function fechar() {
  if (!props.ocupado) emit('fechar')
}
function focaveis() {
  return Array.from(
    painel.value?.querySelectorAll<HTMLElement>(
      'button, input, select, textarea, a[href], [tabindex]',
    ) ?? [],
  ).filter(
    (el) =>
      !el.matches(':disabled') &&
      el.tabIndex >= 0 &&
      el.getClientRects().length > 0 &&
      !el.closest('[inert]'),
  )
}
function teclado(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    fechar()
    return
  }
  if (event.key !== 'Tab') return
  const campos = focaveis()
  const primeiro = campos[0]
  const ultimo = campos[campos.length - 1]
  if (!primeiro || !ultimo) {
    event.preventDefault()
    painel.value?.focus()
    return
  }
  if (
    !painel.value?.contains(document.activeElement) ||
    (event.shiftKey &&
      (document.activeElement === primeiro || document.activeElement === painel.value))
  ) {
    event.preventDefault()
    ;(event.shiftKey ? ultimo : primeiro).focus()
  } else if (!event.shiftKey && document.activeElement === ultimo) {
    event.preventDefault()
    primeiro.focus()
  }
}
onMounted(() => {
  if (paineisAbertos++ === 0) {
    overflowOriginal = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  ;(focaveis()[0] ?? painel.value)?.focus()
  document.addEventListener('keydown', teclado)
})
onUnmounted(() => {
  document.removeEventListener('keydown', teclado)
  if (--paineisAbertos === 0) document.body.style.overflow = overflowOriginal
  void nextTick(() => {
    if (paineisAbertos === 0 && focoAnterior?.isConnected) focoAnterior.focus()
  })
})
</script>
<template>
  <div class="drawer-overlay" @click.self="fechar">
    <section
      ref="painel"
      class="drawer-panel"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="tituloId"
      :aria-busy="ocupado"
      tabindex="-1"
    >
      <header>
        <div>
          <p>{{ subtitulo ?? 'Novo cadastro' }}</p>
          <h2 :id="tituloId">{{ titulo }}</h2>
        </div>
        <button type="button" aria-label="Fechar painel" :disabled="ocupado" @click="fechar">
          <Icon name="fechar" />
        </button>
      </header>
      <slot />
    </section>
  </div>
</template>
