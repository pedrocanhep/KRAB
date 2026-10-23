import { useAuthStore } from '../stores/auth'

// As consultas e cadastros compartilham os erros da API. Traduzimos os nomes
// internos dos campos para que a validação seja compreensível no formulário.
export async function verificarResposta(resposta: Response): Promise<void> {
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
  const labels: Record<string, string> = {
    conta_id: 'Conta',
    descricao: 'Descrição',
    valor: 'Valor',
    categoria: 'Categoria',
    data_vencimento: 'Vencimento',
    data_recebimento: 'Data de recebimento',
    nome: 'Nome',
    tipo: 'Tipo de conta',
    saldo_inicial: 'Saldo inicial',
  }
  const detalhes = erro?.detalhes
    ?.map((item) => {
      // O campo de conta é preenchido automaticamente; não exibimos a validação UUID.
      if (item.campo === 'conta_id') return 'Conta: não foi possível identificar uma conta ativa.'
      return `${labels[item.campo] ?? 'Campo'}: ${item.mensagem}`
    })
    .join('; ')
  throw new Error(
    erro?.mensagem || detalhes || 'Não foi possível concluir a operação. Tente novamente.',
  )
}

// Todas as operações financeiras passam pela API e pelo token da sessão em memória.
export async function requisitar<T>(
  caminho: string,
  token: string,
  payload?: unknown,
  metodo?: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
): Promise<T> {
  const resposta = await fetch(`http://localhost:3333${caminho}`, {
    method: metodo ?? (payload === undefined ? 'GET' : 'POST'),
    headers: {
      Authorization: `Bearer ${token}`,
      ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  })
  await verificarResposta(resposta)
  return resposta.json() as Promise<T>
}

export function mensagemErro(erro: unknown): string {
  return erro instanceof TypeError
    ? 'Não foi possível conectar ao sistema. Tente novamente em instantes.'
    : erro instanceof Error
      ? erro.message
      : 'Não foi possível concluir a operação.'
}
