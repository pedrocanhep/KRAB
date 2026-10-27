// Definido diretamente aqui para remover a importação quebrada do arquivo de cadastro
const SENHA_MINIMA = 6

// Traduz os erros do Supabase Auth em respostas HTTP em português. Sem dependências de config,
// para poder ser testado sozinho.
export interface ErroAuth {
  code?: string
  status?: number
}

export interface RespostaErro {
  status: number
  corpo: { erro: string; mensagem: string }
}

export function traduzirErroCadastro(error: ErroAuth): RespostaErro {
  switch (error.code) {
    case 'user_already_exists':
    case 'email_exists':
      return {
        status: 409,
        corpo: { erro: 'email_ja_cadastrado', mensagem: 'Já existe um cadastro com esse e-mail.' },
      }
    case 'weak_password':
      return {
        status: 422,
        corpo: {
          erro: 'senha_fraca',
          mensagem: `Senha fraca. Use no mínimo ${SENHA_MINIMA} caracteres, misturando letras e números.`,
        },
      }
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return {
        status: 429,
        corpo: {
          erro: 'muitas_tentativas',
          mensagem: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
        },
      }
    case 'email_address_invalid':
      return {
        status: 422,
        corpo: { erro: 'dados_invalidos', mensagem: 'E-mail inválido ou não aceito.' },
      }
    case 'signup_disabled':
    case 'email_provider_disabled':
      return {
        status: 403,
        corpo: {
          erro: 'cadastro_desativado',
          mensagem: 'O cadastro de novos usuários está desativado.',
        },
      }
  }
  // Sem status (falha de rede) ou erro do servidor do Supabase: o problema não é dos dados.
  if (!error.status || error.status >= 500) {
    return {
      status: 503,
      corpo: {
        erro: 'servico_indisponivel',
        mensagem: 'Não foi possível concluir o cadastro. Tente novamente.',
      },
    }
  }
  return {
    status: 422,
    corpo: {
      erro: 'dados_invalidos',
      mensagem: 'Não foi possível concluir o cadastro. Confira os dados e tente novamente.',
    },
  }
}
