import type { FastifyInstance } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { config } from '../config.ts'
import { traduzirErroCadastro } from '../errosCadastro.ts'
import { criarLimitador } from '../limitador.ts'
import { cadastroSchema, reenviarConfirmacaoSchema } from '../schemas/cadastro.ts'

const JANELA_MS = 15 * 60 * 1000
const permitirCadastro = criarLimitador(5, JANELA_MS)
const permitirReenvio = criarLimitador(3, JANELA_MS)

const MUITAS_TENTATIVAS = {
  erro: 'muitas_tentativas',
  mensagem: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
}

// Um cliente por requisição, sem guardar sessão (mesmo cuidado do login).
function clienteAnonimo() {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

// Para onde o link do e-mail de confirmação leva. Precisa estar na lista de "Redirect URLs"
// do Supabase (Authentication, URL Configuration); caso contrário ele usa a "Site URL".
const urlConfirmacao = () => `${config.corsOrigin}/login`

// Rotas PÚBLICAS (sem token): quem se cadastra ainda não tem login.
export async function cadastroRoutes(app: FastifyInstance) {
  // Cadastro de usuário. O e-mail e a senha ficam no Supabase Auth; o nome vai como metadado e o
  // gatilho do banco o copia para o perfil. NÃO devolvemos token: a pessoa entra pelo /auth/login.
  app.post('/auth/cadastro', async (req, reply) => {
    reply.header('Cache-Control', 'no-store')
    if (!permitirCadastro(req.ip)) return reply.code(429).send(MUITAS_TENTATIVAS)

    const dados = cadastroSchema.parse(req.body)
    const { data, error } = await clienteAnonimo().auth.signUp({
      email: dados.email,
      password: dados.password,
      options: { data: { nome: dados.nome }, emailRedirectTo: urlConfirmacao() },
    })

    if (error) {
      const resposta = traduzirErroCadastro(error)
      // Registramos só o código do erro, nunca e-mail, senha ou token.
      if (resposta.status >= 500) {
        req.log.error({ code: error.code, status: error.status }, 'falha no cadastro de usuário')
      }
      return reply.code(resposta.status).send(resposta.corpo)
    }

    // Sem sessão = o Supabase exige confirmar o e-mail antes do primeiro login.
    const confirmacaoPendente = data.session === null
    return reply.code(201).send({
      mensagem: confirmacaoPendente
        ? 'Cadastro realizado. Enviamos um link de confirmação para o seu e-mail. Confirme antes de entrar.'
        : 'Cadastro realizado. Você já pode entrar.',
      confirmacao_pendente: confirmacaoPendente,
    })
  })

  // Reenvia o e-mail de confirmação. A resposta é sempre a mesma, exista ou não o cadastro,
  // para não revelar quais e-mails estão cadastrados.
  app.post('/auth/reenviar-confirmacao', async (req, reply) => {
    reply.header('Cache-Control', 'no-store')
    if (!permitirReenvio(req.ip)) return reply.code(429).send(MUITAS_TENTATIVAS)

    const { email } = reenviarConfirmacaoSchema.parse(req.body)
    const { error } = await clienteAnonimo().auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: urlConfirmacao() },
    })

    if (error) {
      const resposta = traduzirErroCadastro(error)
      if (resposta.status === 429 || resposta.status === 503) {
        return reply.code(resposta.status).send(resposta.corpo)
      }
    }
    return {
      mensagem:
        'Se existir um cadastro aguardando confirmação para esse e-mail, enviamos um novo link.',
    }
  })
}
