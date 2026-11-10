import { requisitar } from './http'

export type TipoConta = 'corrente' | 'poupanca' | 'caixa' | 'outro'
export type Situacao = 'ativas' | 'excluidas' | 'todas'
export interface DadosBancarios {
  cod_banco?: string | null
  agencia?: string | null
  num_conta?: string | null
  digito_verificador?: string | null
}
export interface CriarConta extends DadosBancarios {
  nome: string
  tipo: TipoConta
  saldo_inicial: string
}
export interface Conta extends DadosBancarios {
  id: string
  nome: string
  tipo: TipoConta
  saldo_disponivel: number
  deleted_at: string | null
  created_at: string
  updated_at: string
}
export interface EventoSaldo {
  id: number | string
  valor: number
  motivo: string
  created_at: string
  origem_tipo?: string
  origem_id?: string
}
export interface DetalheConta extends Conta {
  ultimas_movimentacoes: EventoSaldo[]
}
export interface Lista<T> {
  itens: T[]
  total: number
  limit: number
  offset: number
}
export const nomesTipoConta: Record<TipoConta, string> = {
  corrente: 'Conta corrente',
  poupanca: 'Poupança',
  caixa: 'Caixa',
  outro: 'Outro',
}
export function criarConta(payload: CriarConta, token: string) {
  return requisitar<Conta>('/contas', token, payload)
}
export function listarContas(token: string, offset = 0, filtros = new URLSearchParams()) {
  const query = new URLSearchParams(filtros)
  query.set('limit', '100')
  query.set('offset', String(offset))
  return requisitar<Lista<Conta>>(`/contas?${query}`, token)
}
export async function todasContas(token: string, situacao: Situacao = 'ativas'): Promise<Conta[]> {
  const contas: Conta[] = []
  let pagina: Lista<Conta>
  do {
    pagina = await listarContas(token, contas.length, new URLSearchParams({ situacao }))
    contas.push(...pagina.itens)
  } while (pagina.itens.length && contas.length < pagina.total)
  return contas
}
export function obterConta(id: string, token: string) {
  return requisitar<DetalheConta>(`/contas/${id}`, token)
}
export function editarConta(
  id: string,
  payload: Partial<Pick<Conta, 'nome' | 'tipo'> & DadosBancarios>,
  token: string,
) {
  return requisitar<Conta>(`/contas/${id}`, token, payload, 'PATCH')
}
export function excluirConta(id: string, token: string) {
  return requisitar<Conta>(`/contas/${id}`, token, undefined, 'DELETE')
}
export function restaurarConta(id: string, token: string) {
  return requisitar<Conta>(`/contas/${id}/restauracao`, token, {})
}
