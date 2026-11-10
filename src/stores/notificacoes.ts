import { ref } from 'vue'
import { defineStore } from 'pinia'

export type TipoNotificacao = 'sucesso' | 'erro' | 'aviso' | 'informacao'
export interface NovaNotificacao {
  tipo: TipoNotificacao
  titulo: string
  mensagem: string
  grupo?: string
  duracao?: number
  acao?: { texto: string; destino: string }
}
export interface Notificacao extends NovaNotificacao {
  id: number
}

export const useNotificacoesStore = defineStore('notificacoes', () => {
  const itens = ref<Notificacao[]>([])
  let sequencia = 0
  const prazos = new Map<
    number,
    { timer?: ReturnType<typeof setTimeout>; inicio: number; restante: number }
  >()

  function remover(id: number) {
    const prazo = prazos.get(id)
    if (prazo?.timer) clearTimeout(prazo.timer)
    prazos.delete(id)
    itens.value = itens.value.filter((item) => item.id !== id)
  }
  function retomar(id: number) {
    const prazo = prazos.get(id)
    if (!prazo || prazo.timer) return
    if (prazo.restante <= 0) {
      remover(id)
      return
    }
    prazo.inicio = Date.now()
    prazo.timer = setTimeout(() => remover(id), prazo.restante)
  }
  function pausar(id: number) {
    const prazo = prazos.get(id)
    if (!prazo?.timer) return
    clearTimeout(prazo.timer)
    prazo.timer = undefined
    prazo.restante -= Date.now() - prazo.inicio
  }
  function adicionar(dados: NovaNotificacao) {
    if (dados.grupo) {
      for (const item of itens.value) if (item.grupo === dados.grupo) remover(item.id)
    }
    const id = ++sequencia
    const duracao = dados.duracao ?? (dados.tipo === 'erro' || dados.tipo === 'aviso' ? 0 : 6500)
    while (itens.value.length >= 4) remover(itens.value[0]!.id)
    itens.value.push({ ...dados, id })
    if (duracao > 0) {
      prazos.set(id, { inicio: Date.now(), restante: duracao })
      retomar(id)
    }
    return id
  }
  return { itens, adicionar, remover, pausar, retomar }
})
