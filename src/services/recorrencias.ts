import { requisitar } from './http'
import type { Lista } from './contas'
import type { Despesa } from './despesas'
export interface CriarRecorrencia {
  conta_id: string
  descricao: string
  valor: string
  categoria: string
  frequencia: 'diaria' | 'semanal' | 'mensal'
  data_inicio: string
  data_fim?: string
}
export interface Recorrencia extends Omit<CriarRecorrencia, 'valor' | 'data_fim'> {
  id: string
  valor: number
  data_fim: string | null
  status: 'ativa' | 'finalizada'
  finalizada_em: string | null
  created_at: string
  updated_at: string
}
export interface DetalheRecorrencia extends Recorrencia {
  ocorrencias: Pick<
    Despesa,
    'id' | 'descricao' | 'valor' | 'data_vencimento' | 'status' | 'data_pagamento'
  >[]
}
export type EditarRecorrencia = Partial<
  Pick<CriarRecorrencia, 'conta_id' | 'descricao' | 'valor' | 'categoria'>
> & { data_fim?: string | null }
export const frequencias = { diaria: 'Diária', semanal: 'Semanal', mensal: 'Mensal' }
export function criarRecorrencia(payload: CriarRecorrencia, token: string) {
  return requisitar<{ recorrencia: Recorrencia; ocorrencias_geradas: number }>(
    '/despesas-recorrentes',
    token,
    payload,
  )
}
export function listarRecorrencias(token: string, filtros: URLSearchParams) {
  return requisitar<Lista<Recorrencia>>(`/despesas-recorrentes?${filtros}`, token)
}
export function obterRecorrencia(id: string, token: string) {
  return requisitar<DetalheRecorrencia>(`/despesas-recorrentes/${id}`, token)
}
export function editarRecorrencia(id: string, payload: EditarRecorrencia, token: string) {
  return requisitar<{ recorrencia: Recorrencia; ocorrencias_geradas: number }>(
    `/despesas-recorrentes/${id}`,
    token,
    payload,
    'PATCH',
  )
}
export function finalizarRecorrencia(id: string, token: string) {
  return requisitar<{ recorrencia: Recorrencia; ocorrencias_canceladas: number }>(
    `/despesas-recorrentes/${id}/finalizacao`,
    token,
    {},
  )
}
export function gerarOcorrencias(token: string) {
  return requisitar<{ ocorrencias_geradas: number }>('/despesas-recorrentes/geracao', token, {})
}
