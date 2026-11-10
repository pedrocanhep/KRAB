import { requisitar } from './http'
import type { EventoSaldo, Lista } from './contas'

export interface CriarReceita {
  conta_id: string
  descricao: string
  valor: string
  data_recebimento: string
  categoria: string
}
export interface Receita extends Omit<CriarReceita, 'valor'> {
  id: string
  valor: number
  deleted_at: string | null
  created_at: string
  updated_at: string
}
export interface DetalheReceita extends Receita {
  historico: EventoSaldo[]
}
export function criarReceita(payload: CriarReceita, token: string, chave?: string) {
  return requisitar<Receita>(
    '/receitas',
    token,
    payload,
    'POST',
    chave ? { 'Idempotency-Key': chave } : {},
  )
}
export function listarReceitas(token: string, offset = 0, filtros = new URLSearchParams()) {
  const query = new URLSearchParams(filtros)
  query.set('limit', '100')
  query.set('offset', String(offset))
  return requisitar<Lista<Receita>>(`/receitas?${query}`, token)
}
export function obterReceita(id: string, token: string) {
  return requisitar<DetalheReceita>(`/receitas/${id}`, token)
}
export function editarReceita(
  id: string,
  payload: Partial<Omit<CriarReceita, 'conta_id'>>,
  token: string,
) {
  return requisitar<Receita>(`/receitas/${id}`, token, payload, 'PATCH')
}
export function excluirReceita(id: string, token: string) {
  return requisitar<Receita>(`/receitas/${id}`, token, undefined, 'DELETE')
}
export function restaurarReceita(id: string, token: string) {
  return requisitar<Receita>(`/receitas/${id}/restauracao`, token, {})
}
