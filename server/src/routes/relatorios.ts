import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { autenticar } from '../auth.ts'
import { responderErroDb } from '../errors.ts'
import { extratoSchema, relatorioSchema } from '../schemas/relatorio.ts'

// Tudo aqui é SOMENTE LEITURA. As funções SQL rodam como o usuário (RLS), então
// cada pessoa só vê os próprios dados.

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

  // RF4: extrato do período (entradas e saídas pagas), com totais e saldo atual
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

  // RF5 e RF6: total por categoria, com percentual
  app.get('/relatorios/receitas', relatorioPorCategoria('receitas'))
  app.get('/relatorios/despesas', relatorioPorCategoria('despesas'))

  // Tela inicial: saldo, entradas e saídas de 30 dias, alertas, movimentações recentes
  app.get('/dashboard', async (req, reply) => {
    const { data, error } = await req.db.rpc('dashboard')
    if (error) return responderErroDb(reply, error)
    return data
  })
}
