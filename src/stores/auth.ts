import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', () => {
  // Estado compartilhado apenas em memória: recarregar a página exige novo login.
  // Não guardamos senha nem refresh token e não usamos armazenamento do navegador.
  const accessToken = ref('')
  const expiresAt = ref(0)

  function definirSessao(token: string, validade: number) {
    accessToken.value = token
    expiresAt.value = validade
  }

  function invalidarToken() {
    accessToken.value = ''
    expiresAt.value = 0
  }

  function obterToken(): string {
    // A checagem local evita enviar token vencido; a API continua sendo a autoridade.
    if (!accessToken.value || Date.now() >= expiresAt.value * 1000) {
      invalidarToken()
      throw new Error('Sessão ausente ou expirada. Entre novamente em /login.')
    }
    return accessToken.value
  }

  return { accessToken, expiresAt, definirSessao, invalidarToken, obterToken }
})
