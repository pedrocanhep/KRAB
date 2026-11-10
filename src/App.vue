<script setup lang="ts">
import { computed, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import NotificacoesFlutuantes from './components/feedback/NotificacoesFlutuantes.vue'
import { useAuthStore } from './stores/auth'
import { useNotificacoesStore } from './stores/notificacoes'
import { usePreferenciasStore } from './stores/preferencias'
const preferencias = usePreferenciasStore()
const auth = useAuthStore()
const route = useRoute()
const notificacoes = useNotificacoesStore()
const sessaoAusente = computed(
  () => route.matched.length > 0 && !route.meta.publica && !auth.accessToken,
)
// Um sucesso de login não deve permanecer visível depois de sair ou perder a sessão.
watch(
  () => auth.accessToken,
  (atual, anterior) => {
    if (!atual && anterior) {
      for (const item of notificacoes.itens)
        if (item.grupo === 'autenticacao') notificacoes.remover(item.id)
    }
  },
)
let avisoSessao: number | undefined
watch(sessaoAusente, (ausente) => {
  if (avisoSessao !== undefined) {
    notificacoes.remover(avisoSessao)
    avisoSessao = undefined
  }
  if (ausente)
    avisoSessao = notificacoes.adicionar({
      grupo: 'sessao',
      tipo: 'aviso',
      titulo: 'Entre novamente para continuar',
      mensagem:
        'Sua sessão está ausente ou expirada. Os dados do formulário permanecem nesta tela.',
      acao: { texto: 'Ir para o login', destino: '/login' },
    })
})
</script>
<template>
  <RouterView />
  <NotificacoesFlutuantes v-if="preferencias.visualizacao.notificacoes" />
</template>
