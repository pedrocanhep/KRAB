<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import AuthLayout from '../components/auth/AuthLayout.vue'
import { useAuthStore } from '../stores/auth'
const auth = useAuthStore()
const autenticado = computed(() => Boolean(auth.accessToken) && Date.now() < auth.expiresAt * 1000)
</script>
<template>
  <AuthLayout
    titulo="Página não encontrada"
    descricao="O endereço pode ter mudado ou não existir mais. Vamos encontrar o caminho de volta."
    etapa="UM PEQUENO DESVIO"
  >
    <span class="auth-404-code" aria-label="Erro 404">404</span>
    <div class="auth-404-actions">
      <RouterLink class="auth-primary" :to="autenticado ? '/' : '/login'">{{
        autenticado ? 'Voltar ao início' : 'Voltar ao login'
      }}</RouterLink
      ><RouterLink v-if="!autenticado" class="auth-secondary" to="/cadastro"
        >Criar uma conta</RouterLink
      >
    </div>
    <template #footer><p>Seu controle financeiro continua no KRAB.</p></template>
  </AuthLayout>
</template>
