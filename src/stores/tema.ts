import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useNotificacoesStore } from './notificacoes.ts'

export type Tema = 'dark' | 'light'
export const chaveTema = 'krab.tema.v1'
export function lerTema(): Tema {
  try {
    return localStorage.getItem(chaveTema) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}
export const useTemaStore = defineStore('tema', () => {
  const atual = ref<Tema>(lerTema())
  const erroPersistencia = ref('')
  const acao = computed(() => (atual.value === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'))
  function alternar() {
    atual.value = atual.value === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = atual.value
    try {
      localStorage.setItem(chaveTema, atual.value)
      erroPersistencia.value = ''
    } catch {
      erroPersistencia.value =
        'O navegador não permitiu salvar o tema. A mudança vale nesta sessão.'
      useNotificacoesStore().adicionar({
        tipo: 'erro',
        titulo: 'Tema não salvo',
        mensagem: erroPersistencia.value,
        grupo: 'persistencia-tema',
      })
    }
  }
  return { atual, acao, erroPersistencia, alternar }
})
