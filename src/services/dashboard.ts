import { requisitar } from './http'

export interface Movimento {
  id: string
  tipo: 'receita' | 'despesa'
  descricao: string
  valor: number
  data: string
  created_at: string
}

interface Dashboard {
  movimentacoes_recentes: Movimento[]
}

// A função SQL unifica receitas e despesas pagas, aplica RLS, ordena por data
// financeira decrescente e limita a oito. Não reordenamos por data de cadastro.
export function obterDashboard(token: string): Promise<Dashboard> {
  return requisitar<Dashboard>('/dashboard', token)
}

export const moeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)

// A data financeira não contém horário. Exibi-la sem inventar uma hora evita
// confundir o recebimento/pagamento com created_at (momento do cadastro).
export function dataFinanceira(data: string): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(`${data}T12:00:00`))
}
