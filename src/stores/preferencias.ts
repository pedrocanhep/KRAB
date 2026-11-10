import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useNotificacoesStore } from './notificacoes.ts'

export const chavePreferencias = 'krab.visualizacao.v1'
export const padraoVisualizacao = {
  alertas: true,
  resumo: true,
  atividades: true,
  atalhos: true,
  menuFlutuante: true,
  notificacoes: true,
}
export type Preferencias = typeof padraoVisualizacao
export function lerPreferencias(): Preferencias {
  const resultado = { ...padraoVisualizacao }
  try {
    const salvo: unknown = JSON.parse(localStorage.getItem(chavePreferencias) ?? 'null')
    if (salvo && typeof salvo === 'object') {
      for (const chave of Object.keys(resultado) as (keyof Preferencias)[]) {
        if (chave in salvo && typeof salvo[chave as keyof typeof salvo] === 'boolean')
          resultado[chave] = Reflect.get(salvo, chave) as boolean
      }
    }
  } catch {
    /* Navegação sem armazenamento mantém os padrões. */
  }
  return resultado
}
export const usePreferenciasStore = defineStore('preferencias', () => {
  const visualizacao = ref(lerPreferencias())
  const erroPersistencia = ref('')
  watch(
    visualizacao,
    (valor) => {
      try {
        localStorage.setItem(chavePreferencias, JSON.stringify(valor))
        erroPersistencia.value = ''
      } catch {
        erroPersistencia.value =
          'As mudanças valem nesta sessão, mas o navegador não permitiu salvá-las.'
        useNotificacoesStore().adicionar({
          tipo: 'erro',
          titulo: 'Preferências não salvas',
          mensagem: erroPersistencia.value,
          grupo: 'persistencia-preferencias',
        })
      }
    },
    { deep: true, flush: 'sync' },
  )
  function restaurar() {
    visualizacao.value = { ...padraoVisualizacao }
  }
  return { visualizacao, erroPersistencia, restaurar }
})
