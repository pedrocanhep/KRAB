import { requisitar } from './http'

export interface ResumoDesenvolvimento {
  entradas: number
  saidas: number
  saldo: number
}

// TODO: esta soma geral valida somente a integração. Futuramente usar a regra
// financeira oficial por contas, status e saldo real, sem reutilizar estes totais.
export function obterResumoDesenvolvimento(token: string): Promise<ResumoDesenvolvimento> {
  return requisitar<ResumoDesenvolvimento>('/resumo-desenvolvimento', token)
}
