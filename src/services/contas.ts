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
