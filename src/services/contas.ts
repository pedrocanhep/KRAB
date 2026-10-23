import { requisitar } from './http'

export interface CriarConta {
  nome: string
  tipo: 'corrente' | 'poupanca' | 'caixa' | 'outro'
  saldo_inicial: string
}

// Os dados bancários opcionais não são necessários para o cadastro mínimo.
export function criarConta(payload: CriarConta, token: string): Promise<unknown> {
  return requisitar('/contas', token, payload)
}

export interface Conta {
  id: string
  nome: string
  tipo: CriarConta['tipo']
  saldo_disponivel: number
}
export interface Lista<T> {
  itens: T[]
  total: number
  limit: number
  offset: number
}
export function listarContas(token: string, offset = 0) {
  return requisitar<Lista<Conta>>(`/contas?limit=100&offset=${offset}`, token)
}
export async function todasContas(token: string): Promise<Conta[]> {
  const contas: Conta[] = []
  let pagina: Lista<Conta>
  do {
    pagina = await listarContas(token, contas.length)
    contas.push(...pagina.itens)
  } while (pagina.itens.length && contas.length < pagina.total)
  return contas
}
export function editarConta(id: string, payload: Pick<Conta, 'nome' | 'tipo'>, token: string) {
  return requisitar(`/contas/${id}`, token, payload, 'PATCH')
}
export function excluirConta(id: string, token: string) {
  return requisitar(`/contas/${id}`, token, undefined, 'DELETE')
}
