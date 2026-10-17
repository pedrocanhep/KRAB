import { requisitar } from './http'

interface CriarReceita {
  conta_id: string
  descricao: string
  valor: string
  data_recebimento: string
  categoria: string
}

export function criarReceita(payload: CriarReceita, token: string): Promise<unknown> {
  return requisitar('/receitas', token, payload)
}
