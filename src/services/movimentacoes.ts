import { requisitar } from './http'
import type { Lista } from './contas'
export interface MovimentoSaldo {
  id: number | string
  conta_id: string
  conta_nome: string
  origem_tipo: 'receita' | 'despesa' | 'ajuste'
  origem_id: string
  descricao: string | null
  categoria: string | null
  motivo: string
  rotulo: string
  valor: number
  saldo_apos: number
  created_at: string
}
export function listarMovimentacoes(token: string, filtros: URLSearchParams) {
  return requisitar<Lista<MovimentoSaldo>>(`/movimentacoes?${filtros}`, token)
}
