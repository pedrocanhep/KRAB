// URL da API fixa. Mude para variável de ambiente antes do deploy se necessário.
const API = 'http://localhost:3333'

export interface DadosCadastro {
  nome: string
  email: string
  password: string
  confirmar_senha: string
}

interface RespostaCadastro {
  mensagem: string
  confirmacao_pendente: boolean
}

interface ErroApi {
  erro?: string
  mensagem?: string
  detalhes?: { campo: string; mensagem: string }[]
}

// Mensagens conhecidas do contrato: falhas internas não expõem detalhes do serviço.
async function erroDaResposta(resposta: Response, padrao: string): Promise<Error> {
  const erro = (await resposta.json().catch(() => null)) as ErroApi | null
  if (resposta.status >= 500)
    return new Error('O serviço está indisponível no momento. Tente novamente em instantes.')
  if (resposta.status === 429)
    return new Error('Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.')
  const mensagens: Record<string, string> = {
    email_ja_cadastrado: 'Já existe um cadastro com este e-mail. Tente entrar na sua conta.',
    senha_fraca: 'Escolha uma senha mais forte e tente novamente.',
    cadastro_desativado: 'O cadastro de novas contas não está disponível no momento.',
    dados_invalidos: 'Confira os dados informados e tente novamente.',
  }
  if (erro?.erro && mensagens[erro.erro]) return new Error(mensagens[erro.erro])
  if (resposta.status === 422) return new Error('Confira os dados informados e tente novamente.')
  return new Error(padrao)
}

// POST /auth/cadastro
export async function cadastrarUsuario(
  dados: DadosCadastro,
  signal?: AbortSignal,
): Promise<RespostaCadastro> {
  if (dados.password !== dados.confirmar_senha) {
    throw new Error('A senha e a confirmação de senha não coincidem.')
  }

  const resposta = await fetch(`${API}/auth/cadastro`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })

  if (!resposta.ok) {
    throw await erroDaResposta(resposta, 'Não foi possível concluir o cadastro. Tente novamente.')
  }
  const resultado = (await resposta.json().catch(() => null)) as RespostaCadastro | null
  if (
    !resultado ||
    typeof resultado.mensagem !== 'string' ||
    typeof resultado.confirmacao_pendente !== 'boolean'
  ) {
    throw new Error(
      'Não foi possível confirmar o resultado do cadastro. Tente novamente em instantes.',
    )
  }
  return resultado
}

// POST /auth/reenviar-confirmacao
export async function reenviarConfirmacao(email: string, signal?: AbortSignal): Promise<string> {
  const resposta = await fetch(`${API}/auth/reenviar-confirmacao`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  if (!resposta.ok) {
    throw await erroDaResposta(resposta, 'Não foi possível reenviar o e-mail. Tente novamente.')
  }

  const corpo = (await resposta.json().catch(() => null)) as { mensagem?: string } | null
  if (!corpo || typeof corpo.mensagem !== 'string')
    throw new Error('Não foi possível confirmar o reenvio. Tente novamente em instantes.')
  return corpo.mensagem
}
