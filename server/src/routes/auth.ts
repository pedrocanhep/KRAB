import type { FastifyInstance } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { config } from '../config.ts'

const loginSchema = z
  .object({
    email: z.string().trim().email(),
    // Senhas são enviadas exatamente como digitadas, sem trim.
    password: z.string().min(1),
  })
  .strict()

export async function authRoutes(app: FastifyInstance) {
  // O login é público; as demais rotas continuam com sua validação Bearer atual.
  app.post('/auth/login', async (req, reply) => {
    const credenciais = loginSchema.parse(req.body)
    // Um cliente por requisição evita compartilhar sessões entre usuários.
    // Não persistimos sessão nem iniciamos renovação automática no servidor.
    const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const { data, error } = await supabase.auth.signInWithPassword(credenciais)
    // Respostas de autenticação não devem ser armazenadas em cache.
    reply.header('Cache-Control', 'no-store')
    if (error || !data.session) {
      if (error && error.status !== 400 && error.status !== 401 && error.status !== 422) {
        return reply
          .code(503)
          .send({ mensagem: 'Não foi possível realizar o login. Tente novamente.' })
      }
      return reply
        .code(401)
        .send({ mensagem: 'E-mail ou senha inválidos, ou usuário não confirmado.' })
    }
    // O refresh token fornecido pelo Supabase não é repassado ao navegador.
    return { access_token: data.session.access_token, expires_at: data.session.expires_at }
  })
}
