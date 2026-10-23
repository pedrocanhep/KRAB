<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import Icon from './DashboardIcon.vue'

defineProps<{ titulo: string; ocupado: boolean; subtitulo?: string }>()
const emit = defineEmits<{ fechar: [] }>()
const painel = ref<HTMLElement>()
const focoAnterior = document.activeElement as HTMLElement | null
const overflowAnterior = document.body.style.overflow

// O fundo recebe inert na Home. Aqui prendemos o foco no diálogo e o devolvemos
// ao atalho ao desmontar. Toda tentativa de fechamento passa pela view.
function teclado(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('fechar')
  if (event.key !== 'Tab') return
  const campos = painel.value?.querySelectorAll<HTMLElement>(
    'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]',
  )
  if (!campos?.length) return
  const primeiro = campos[0]!
  const ultimo = campos[campos.length - 1]!
  if (event.shiftKey && document.activeElement === primeiro) {
    event.preventDefault()
    ultimo.focus()
  } else if (!event.shiftKey && document.activeElement === ultimo) {
    event.preventDefault()
    primeiro.focus()
  }
}
onMounted(() => {
  document.body.style.overflow = 'hidden'
  painel.value?.querySelector('button')?.focus()
  document.addEventListener('keydown', teclado)
})
onUnmounted(() => {
  document.body.style.overflow = overflowAnterior
  document.removeEventListener('keydown', teclado)
  focoAnterior?.focus()
})
</script>

<template>
  <div class="drawer-overlay" @click.self="emit('fechar')">
    <section
      ref="painel"
      class="drawer-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-titulo"
      :aria-busy="ocupado"
    >
      <header>
        <div>
          <p>{{ subtitulo ?? 'Novo cadastro' }}</p>
          <h2 id="drawer-titulo">{{ titulo }}</h2>
        </div>
        <button
          type="button"
          aria-label="Fechar painel"
          :disabled="ocupado"
          @click="emit('fechar')"
        >
          <Icon name="fechar" />
        </button>
      </header>
      <slot />
    </section>
  </div>
</template>
