import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { autenticar } from '../auth.ts'
import { responderErroDb } from '../errors.ts'
import { extratoSchema, relatorioSchema } from '../schemas/relatorio.ts'

const relatorioPorCategoria =
  (tipo: 'receitas' | 'despesas') => async (req: FastifyRequest, reply: FastifyReply) => {
    const f = relatorioSchema.parse(req.query)

    const { data, error } = await req.db.rpc('relatorio_categorias', {
      p_tipo: tipo,
      p_de: f.de,
      p_ate: f.ate,
      p_conta_id: f.conta_id ?? null,
    })
    if (error) return responderErroDb(reply, error)
    return data
  }

export async function relatoriosRoutes(app: FastifyInstance) {
  app.addHook('preHandler', autenticar)

  app.get('/extrato', async (req, reply) => {
    const f = extratoSchema.parse(req.query)

    const { data, error } = await req.db.rpc('extrato', {
      p_de: f.de,
      p_ate: f.ate,
      p_conta_id: f.conta_id ?? null,
      p_tipo: f.tipo,
      p_ordem: f.ordem,
      p_limit: f.limit,
      p_offset: f.offset,
    })
    if (error) return responderErroDb(reply, error)
    return data
  })

  app.get('/relatorios/receitas', relatorioPorCategoria('receitas'))
  app.get('/relatorios/despesas', relatorioPorCategoria('despesas'))

  app.get('/dashboard', async (req, reply) => {
    const { data, error } = await req.db.rpc('dashboard')
    if (error) return responderErroDb(reply, error)
    return data
  })
}
