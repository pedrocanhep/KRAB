import { requisitar } from './http'
import type { Movimento } from './dashboard'

export interface Extrato {
  saldo_atual: number
  totais: { entradas: number; saidas: number; saldo_periodo: number; quantidade: number }
  itens: (Movimento & { categoria: string; conta_nome: string })[]
}
export interface Relatorio {
  total: number
  quantidade: number
  categorias: { categoria: string; total: number; quantidade: number; percentual: number }[]
  a_pagar: { total: number; quantidade: number } | null
}
export function obterExtrato(filtros: URLSearchParams, token: string) {
  return requisitar<Extrato>(`/extrato?${filtros}`, token)
}
export function obterRelatorio(
  tipo: 'receitas' | 'despesas',
  filtros: URLSearchParams,
  token: string,
) {
  return requisitar<Relatorio>(`/relatorios/${tipo}?${filtros}`, token)
}
