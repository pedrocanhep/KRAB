import { useAuthStore } from '../stores/auth'

// Contrato enviado ao POST: o backend exige valor decimal como texto, não como número.
interface CriarDespesaPayload {
  conta_id: string
  descricao: string
  valor: string
  data_vencimento: string
  categoria: string
}

// Campos da resposta que a tabela utiliza; o backend também retorna outros campos.
export interface Despesa {
  id: string
  descricao: string
  valor: number
  data_vencimento: string
  categoria: string
  status: 'pendente' | 'paga'
}

interface ListagemDespesas {
  itens: Despesa[]
  total: number
  limit: number
  offset: number
}

// As consultas e o cadastro compartilham o formato de erro da API. A mensagem inclui o status
// e os detalhes de validação, mas nunca inclui o token enviado na requisição.
async function verificarResposta(resposta: Response): Promise<void> {
  if (resposta.ok) return

  // Um 401 invalida somente o token local. Não redirecionamos automaticamente:
  // assim os dados digitados na tela continuam disponíveis até o usuário sair.
  if (resposta.status === 401) {
    useAuthStore().invalidarToken()
    throw new Error('Sessão inválida ou expirada. Entre novamente em /login.')
  }

  // Uma resposta sem JSON ainda deve produzir um erro útil com o status HTTP.
  const erro = (await resposta.json().catch(() => null)) as {
    erro?: string
    mensagem?: string
    detalhes?: { campo: string; mensagem: string }[]
  } | null
  const detalhes = erro?.detalhes?.map((item) => `${item.campo}: ${item.mensagem}`).join('; ')
  throw new Error(
    `HTTP ${resposta.status}: ${erro?.erro ?? 'Falha na requisição'}` +
      (erro?.mensagem || detalhes ? ` — ${erro?.mensagem || detalhes}` : ''),
  )
}

// Tipamos apenas o campo da conta usado neste teste, sem criar seleção de conta.
interface ListagemContas {
  itens: { id: string }[]
  total: number
  limit: number
  offset: number
}

export async function obterPrimeiraContaAtiva(token: string): Promise<string> {
  const resposta = await fetch('http://localhost:3333/contas?situacao=ativas', {
    headers: { Authorization: `Bearer ${token}` },
  })
  // Validamos o HTTP antes de usar o corpo; token inválido interrompe o fluxo aqui.
  await verificarResposta(resposta)
  const contas = (await resposta.json()) as ListagemContas
  const conta = contas.itens[0]
  // Sem conta ativa, lançamos um erro antes que a tela possa executar o POST.
  if (!conta) {
    throw new Error(
      'Nenhuma conta ativa encontrada. Cadastre ou reative uma conta antes de cadastrar a despesa.',
    )
  }
  return conta.id
}

// A tela fornece os dados e o token da sessão. Este service envia o JSON ao
// Fastify, que valida a entrada e solicita a persistência ao Supabase.
export async function criarDespesa(payload: CriarDespesaPayload, token: string): Promise<void> {
  const resposta = await fetch('http://localhost:3333/despesas', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token.trim()}`,
    },
    body: JSON.stringify(payload),
  })

  // fetch não lança erro automaticamente para HTTP 401, 422 ou 500.
  await verificarResposta(resposta)
}

// Consulta os registros persistidos, sem aproveitar dados locais do cadastro.
// O token identifica o usuário; sem filtros, a API retorna até 20 despesas ativas.
export async function listarDespesas(token: string): Promise<ListagemDespesas> {
  const resposta = await fetch('http://localhost:3333/despesas', {
    headers: { Authorization: `Bearer ${token.trim()}` },
  })
  await verificarResposta(resposta)
  return (await resposta.json()) as ListagemDespesas
}
