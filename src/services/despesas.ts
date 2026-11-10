import { requisitar } from './http'
import type { EventoSaldo, Lista } from './contas'

export interface CriarDespesaPayload {
  conta_id: string
  descricao: string
  valor: string
  data_vencimento: string
  categoria: string
}
export interface Despesa extends Omit<CriarDespesaPayload, 'valor'> {
  id: string
  valor: number
  status: 'pendente' | 'paga'
  data_pagamento: string | null
  valor_pago: number | null
  deleted_at: string | null
  created_at: string
  updated_at: string
  recorrencia_id: string | null
}
export interface DetalheDespesa extends Despesa {
  historico: EventoSaldo[]
}
export interface ResultadoDespesa {
  despesa: Despesa
  saldo_conta: number
  saldo_negativo: boolean
}
export function criarDespesa(payload: CriarDespesaPayload, token: string, chave?: string) {
  return requisitar<ResultadoDespesa>(
    '/despesas',
    token,
    payload,
    'POST',
    chave ? { 'Idempotency-Key': chave } : {},
  )
}
export function listarDespesas(token: string, offset = 0, filtros = new URLSearchParams()) {
  const query = new URLSearchParams(filtros)
  query.set('limit', '100')
  query.set('offset', String(offset))
  return requisitar<Lista<Despesa>>(`/despesas?${query}`, token)
}
export function obterDespesa(id: string, token: string) {
  return requisitar<DetalheDespesa>(`/despesas/${id}`, token)
}
export function editarDespesa(id: string, payload: Partial<CriarDespesaPayload>, token: string) {
  return requisitar<ResultadoDespesa>(`/despesas/${id}`, token, payload, 'PATCH')
}
export function excluirDespesa(id: string, token: string) {
  return requisitar<ResultadoDespesa>(`/despesas/${id}`, token, undefined, 'DELETE')
}
export function restaurarDespesa(id: string, token: string) {
  return requisitar<ResultadoDespesa>(`/despesas/${id}/restauracao`, token, {})
}
export function pagarDespesa(id: string, token: string, data_pagamento?: string) {
  return requisitar<ResultadoDespesa>(
    `/despesas/${id}/pagamento`,
    token,
    data_pagamento ? { data_pagamento } : {},
  )
}
