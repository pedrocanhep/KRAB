<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useNotificacoesStore } from '../../stores/notificacoes'
const notificacoes = useNotificacoesStore()
function retomar(event: Event, id: number) {
  const elemento = event.currentTarget as HTMLElement
  if (!elemento.matches(':hover, :focus-within')) notificacoes.retomar(id)
}
</script>
<template>
  <section
    class="toast-region"
    aria-label="Notificações do sistema"
    aria-live="polite"
    aria-relevant="additions text"
  >
    <TransitionGroup name="toast" tag="div" class="toast-stack">
      <article
        v-for="item in notificacoes.itens"
        :key="item.id"
        class="toast-item"
        :class="`toast-${item.tipo}`"
        :role="item.tipo === 'erro' ? 'alert' : 'status'"
        aria-atomic="true"
        @mouseenter="notificacoes.pausar(item.id)"
        @mouseleave="retomar($event, item.id)"
        @focusin="notificacoes.pausar(item.id)"
        @focusout="retomar($event, item.id)"
      >
        <span class="toast-symbol" aria-hidden="true"
          ><svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path v-if="item.tipo === 'sucesso'" d="m5 12 4 4L19 6" />
            <template v-else-if="item.tipo === 'erro'">
              <circle cx="12" cy="12" r="9" />
              <path d="m9 9 6 6m0-6-6 6" />
            </template>
            <template v-else-if="item.tipo === 'aviso'">
              <path d="m12 3 10 18H2L12 3Z" />
              <path d="M12 9v5m0 3v.1" />
            </template>
            <template v-else>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v6m0-10v.1" />
            </template></svg
        ></span>
        <div class="toast-content">
          <strong>{{ item.titulo }}</strong>
          <p>{{ item.mensagem }}</p>
          <RouterLink
            v-if="item.acao"
            :to="item.acao.destino"
            @click="notificacoes.remover(item.id)"
            >{{ item.acao.texto }}</RouterLink
          >
        </div>
        <button
          type="button"
          class="toast-close"
          :aria-label="`Fechar notificação: ${item.titulo}`"
          @click="notificacoes.remover(item.id)"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            aria-hidden="true"
          >
            <path d="m6 6 12 12M6 18 18 6" />
          </svg>
        </button>
      </article>
    </TransitionGroup>
  </section>
</template>
<style scoped>
.toast-region {
  position: fixed;
  top: 22px;
  right: 22px;
  z-index: 200;
  width: min(410px, calc(100% - 32px));
  pointer-events: none;
  font:
    14px/1.5 Arial,
    Helvetica,
    sans-serif;
}
.toast-stack {
  display: grid;
  gap: 12px;
}
.toast-item {
  --toast-accent: var(--positive-text-7dd9c0);
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 17px 12px 17px 17px;
  color: var(--text-f1f8f5);
  background: var(--surface-0d2823);
  border: 1px solid var(--border-315349);
  border-left: 3px solid var(--toast-accent);
  border-radius: 15px;
  box-shadow: 0 12px 38px var(--shadow-0005);
  pointer-events: auto;
  overflow-wrap: anywhere;
}
.toast-erro {
  --toast-accent: var(--danger-text-ffa4ac);
  background: var(--danger-surface-2c1c20);
  border-color: var(--border-674049);
  border-left-color: var(--toast-accent);
}
.toast-aviso {
  --toast-accent: var(--warning-text-f4ce88);
  background: var(--warning-surface-28241b);
  border-color: var(--border-5d5135);
  border-left-color: var(--toast-accent);
}
.toast-informacao {
  --toast-accent: var(--info-text-98d5ed);
}
.toast-symbol {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  border-radius: 50%;
  background: var(--wash-ffffff0a);
  color: var(--toast-accent);
}
.toast-symbol svg {
  width: 22px;
  height: 22px;
}
.toast-content {
  flex: 1;
  min-width: 0;
}
.toast-content strong {
  display: block;
  margin: 0 0 4px;
  font-size: 15px;
}
.toast-content p {
  margin: 0;
  color: var(--text-d0ddd7);
}
.toast-content a {
  display: inline-block;
  margin-top: 8px;
  color: var(--toast-accent);
  font-weight: 700;
  text-underline-offset: 3px;
}
.toast-close {
  display: grid;
  place-items: center;
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  margin-top: -4px;
  padding: 7px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-d0ddd7);
  cursor: pointer;
  transition:
    background 0.15s,
    transform 0.15s;
}
.toast-close svg {
  width: 20px;
  height: 20px;
}
.toast-close:hover {
  background: var(--wash-ffffff12);
}
.toast-close:active {
  transform: scale(0.94);
}
.toast-close:focus-visible,
.toast-content a:focus-visible {
  outline: 2px solid var(--toast-accent);
  outline-offset: 3px;
}
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(18px);
}
@media (max-width: 480px) {
  .toast-region {
    top: 12px;
    right: 12px;
    width: calc(100% - 24px);
  }
  .toast-close {
    flex-basis: 40px;
    width: 40px;
    height: 40px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active,
  .toast-close {
    transition: none;
  }
}
</style>
