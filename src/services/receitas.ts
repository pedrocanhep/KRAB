import { requisitar } from './http'

export interface CriarReceita {
  conta_id: string
  descricao: string
  valor: string
  data_recebimento: string
  categoria: string
}

export function criarReceita(payload: CriarReceita, token: string): Promise<unknown> {
  return requisitar('/receitas', token, payload)
}

export interface Receita extends Omit<CriarReceita, 'valor'> {
  id: string
  valor: number
}
export function listarReceitas(token: string, offset = 0) {
  return requisitar<import('./contas').Lista<Receita>>(
    `/receitas?limit=100&offset=${offset}`,
    token,
  )
}
export function editarReceita(id: string, payload: Omit<CriarReceita, 'conta_id'>, token: string) {
  return requisitar(`/receitas/${id}`, token, payload, 'PATCH')
}
export function excluirReceita(id: string, token: string) {
  return requisitar(`/receitas/${id}`, token, undefined, 'DELETE')
}
