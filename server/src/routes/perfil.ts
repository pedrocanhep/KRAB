import type { FastifyInstance } from 'fastify'
import { autenticar } from '../auth.ts'
import { responderErroDb } from '../errors.ts'
import { salvarPerfilSchema } from '../schemas/perfil.ts'

export async function perfilRoutes(app: FastifyInstance) {
  app.addHook('preHandler', autenticar)

  // Perfil do usuário logado (o RLS garante que só vem o dele).
  // Quem ainda não salvou o nome recebe 200 com { nome: null }, para a tela usar um texto padrão.
  app.get('/perfil', async (req, reply) => {
    const { data, error } = await req.db.from('perfil').select('*').maybeSingle()
    if (error) return responderErroDb(reply, error)
    return data ?? { nome: null }
  })

  // Cria o perfil na primeira vez e atualiza nas seguintes.
  app.put('/perfil', async (req, reply) => {
    const body = salvarPerfilSchema.parse(req.body)

    const { data, error } = await req.db.rpc('salvar_perfil', { p_nome: body.nome })
    if (error) return responderErroDb(reply, error)
    return data
  })
}
