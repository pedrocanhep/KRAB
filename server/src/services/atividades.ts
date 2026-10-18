import type { SupabaseClient } from '@supabase/supabase-js'

export const LIMITE_ATIVIDADES = 8

type Registro = { id: string; created_at: string }
type Receita = Registro & { descricao: string; valor: number }
type Despesa = Receita & { status: 'pendente' | 'paga' }
type Conta = Registro & { nome: string }

export type Atividade =
  (Receita & { tipo: 'receita' }) | (Despesa & { tipo: 'despesa' }) | (Conta & { tipo: 'conta' })

// PostgreSQL guarda microssegundos; Date sozinho perderia os últimos três
// dígitos e poderia inverter cadastros feitos no mesmo milissegundo.
function instanteEmMicrossegundos(timestamp: string): bigint {
  const fracao = /\.(\d+)/.exec(timestamp)?.[1] ?? ''
  const microsRestantes = fracao.padEnd(6, '0').slice(3, 6)
  return BigInt(Date.parse(timestamp)) * 1000n + BigInt(microsRestantes)
}

export function ordenarAtividades(itens: Atividade[]): Atividade[] {
  return [...itens]
    .sort((a, b) => {
      const instanteA = instanteEmMicrossegundos(a.created_at)
      const instanteB = instanteEmMicrossegundos(b.created_at)
      if (instanteA !== instanteB) return instanteA > instanteB ? -1 : 1
      // Desempate estável também quando tipos diferentes compartilham timestamp.
      if (a.tipo !== b.tipo) return a.tipo < b.tipo ? -1 : 1
      return a.id === b.id ? 0 : a.id > b.id ? -1 : 1
    })
    .slice(0, LIMITE_ATIVIDADES)
}

// Lista temporária para validar front → backend → banco → leitura de volta.
// Não representa extrato financeiro e pode ser refinada após esta fase.
export async function listarAtividades(db: Pick<SupabaseClient, 'from'>) {
  // Mesmo padrão das outras rotas: req.db carrega o Bearer do usuário e a RLS
  // restringe a leitura. Não usamos cliente administrativo nem mudamos políticas.
  // O top 8 de cada tabela contém necessariamente o top 8 da união: não há
  // necessidade de percorrer páginas, nem de usar vencimento/recebimento/nome.
  const [receitas, despesas, contas] = await Promise.all([
    db
      .from('receita')
      .select('id, descricao, valor, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(LIMITE_ATIVIDADES)
      .returns<Receita[]>(),
    db
      .from('despesa')
      .select('id, descricao, valor, status, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(LIMITE_ATIVIDADES)
      .returns<Despesa[]>(),
    db
      .from('conta')
      .select('id, nome, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(LIMITE_ATIVIDADES)
      .returns<Conta[]>(),
  ])
  const error = receitas.error ?? despesas.error ?? contas.error
  // Uma falha não vira lista parcial nem estado vazio enganoso na interface.
  if (error) return { itens: [], error }
  const itens: Atividade[] = [
    ...(receitas.data ?? []).map((item) => ({ ...item, tipo: 'receita' as const })),
    ...(despesas.data ?? []).map((item) => ({ ...item, tipo: 'despesa' as const })),
    ...(contas.data ?? []).map((item) => ({ ...item, tipo: 'conta' as const })),
  ]
  return { itens: ordenarAtividades(itens), error: null }
}
