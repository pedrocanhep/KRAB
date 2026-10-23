import { requisitar } from './http'

export interface Movimento {
  id: string
  tipo: 'receita' | 'despesa'
  descricao: string
  valor: number
  data: string
  created_at: string
}

export interface Dashboard {
  saldo_total: number
  contas_ativas: number
  entradas_30d: { total: number; quantidade: number }
  saidas_30d: { total: number; quantidade: number }
  mes: { receitas: number; despesas: number }
  proximo_vencimento: { descricao: string; data_vencimento: string } | null
  alertas: {
    id: string
    descricao: string
    valor: number
    data_vencimento: string
    situacao: 'vencida' | 'hoje' | 'proxima'
  }[]
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
