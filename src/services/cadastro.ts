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

const rotulos: Record<string, string> = {
  nome: 'Nome',
  email: 'E-mail',
  password: 'Senha',
  confirmar_senha: 'Confirmação da senha',
}

// Monta a mensagem exibida na tela a partir do erro da API
async function erroDaResposta(resposta: Response, padrao: string): Promise<Error> {
  const erro = (await resposta.json().catch(() => null)) as ErroApi | null
  
  if (erro?.mensagem) {
    return new Error(erro.mensagem)
  }
  
  if (erro?.detalhes) {
    const detalhes = erro.detalhes
      .map((item) => `${rotulos[item.campo] ?? 'Campo'}: ${item.mensagem}`)
      .join('; ')
    if (detalhes) return new Error(detalhes)
  }
  
  return new Error(padrao)
}

// POST /auth/cadastro
export async function cadastrarUsuario(dados: DadosCadastro): Promise<RespostaCadastro> {
  if (dados.password !== dados.confirmar_senha) {
    throw new Error('A senha e a confirmação de senha não coincidem.')
  }

  const resposta = await fetch(`${API}/auth/cadastro`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })
  
  if (!resposta.ok) {
    throw await erroDaResposta(resposta, 'Não foi possível concluir o cadastro. Tente novamente.')
  }
  return (await resposta.json()) as RespostaCadastro
}

// POST /auth/reenviar-confirmacao
export async function reenviarConfirmacao(email: string): Promise<string> {
  const resposta = await fetch(`${API}/auth/reenviar-confirmacao`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  
  if (!resposta.ok) {
    throw await erroDaResposta(resposta, 'Não foi possível reenviar o e-mail. Tente novamente.')
  }
  
  const corpo = (await resposta.json()) as { mensagem: string }
  return corpo.mensagem
}
