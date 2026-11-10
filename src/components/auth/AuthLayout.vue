<script setup lang="ts">
import { nextTick, onMounted, ref, useId, watch } from 'vue'
import logo from '../../../midia/logo-krab-png.png'
import '../../assets/auth.css'
const props = withDefaults(
  defineProps<{ titulo: string; descricao: string; etapa?: string; google?: boolean }>(),
  { etapa: 'SEU CONTROLE FINANCEIRO' },
)
const tituloId = useId()
const cabecalho = ref<HTMLElement>()
onMounted(() => cabecalho.value?.focus())
watch(
  () => props.titulo,
  async () => {
    await nextTick()
    cabecalho.value?.focus()
  },
)
const googleAjudaId = useId()
</script>
<template>
  <main class="auth-shell">
    <div class="auth-frame">
      <aside class="auth-brand" aria-label="KRAB — Keep Resources Always Balanced">
        <img class="auth-logo" :src="logo" alt="KRAB" />
        <div class="auth-brand-message">
          <span class="auth-kicker"
            ><span aria-hidden="true"></span> MAIS CLAREZA. MAIS EQUILÍBRIO.</span
          >
          <h2>Seu dinheiro.<br /><span>Mais claro.</span></h2>
          <p>Organize suas contas e acompanhe o que entra e sai, sem complicar.</p>
          <div class="auth-brand-note">
            <span class="auth-note-icon" aria-hidden="true"
              ><svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
              >
                <path d="M5 18V9m7 9V5m7 13v-7M3 21h18" /></svg
            ></span>
            <div>
              <strong>O essencial, em um só lugar.</strong
              ><span>Receitas, despesas e contas no seu ritmo.</span>
            </div>
          </div>
        </div>
        <p class="auth-signature">KEEP RESOURCES ALWAYS BALANCED</p>
      </aside>
      <section class="auth-card" :aria-labelledby="tituloId">
        <header class="auth-card-heading">
          <p class="auth-eyebrow">{{ etapa }}</p>
          <h1 ref="cabecalho" :id="tituloId" tabindex="-1">{{ titulo }}</h1>
          <p>{{ descricao }}</p>
        </header>
        <slot />
        <template v-if="google"
          ><div class="auth-divider"><span>ou</span></div>
          <button type="button" class="auth-google" disabled :aria-describedby="googleAjudaId">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285f4"
                d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.4Z"
              />
              <path
                fill="#34a853"
                d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.7-5.6-4H3.1v2.6A10 10 0 0 0 12 22Z"
              />
              <path fill="#fbbc05" d="M6.4 14a6 6 0 0 1 0-4V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14Z" />
              <path
                fill="#ea4335"
                d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A9.5 9.5 0 0 0 12 2a10 10 0 0 0-8.9 5.4L6.4 10c.8-2.3 3-4 5.6-4Z"
              /></svg
            ><span>Continuar com Google</span><small>Em breve</small>
          </button>
          <p :id="googleAjudaId" class="auth-unavailable">
            O acesso com Google ainda não está disponível.
          </p></template
        >
        <footer v-if="$slots.footer" class="auth-card-footer"><slot name="footer" /></footer>
      </section>
    </div>
  </main>
</template>
