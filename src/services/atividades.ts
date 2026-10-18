import { requisitar } from './http'

type Registro = { id: string; created_at: string }
export type Atividade =
  | (Registro & { tipo: 'receita'; descricao: string; valor: number })
  | (Registro & { tipo: 'despesa'; descricao: string; valor: number; status: 'pendente' | 'paga' })
  | (Registro & { tipo: 'conta'; nome: string })

interface ListaAtividades {
  itens: Atividade[]
  limit: number
}

// Nesta fase, a lista valida a integração front → backend → banco → leitura.
// A ordenação vem da API; ela não altera o significado financeiro do dashboard.
export function obterAtividades(token: string): Promise<ListaAtividades> {
  return requisitar<ListaAtividades>('/atividades-recentes', token)
}

export function dataCadastro(timestamp: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(timestamp))
}
