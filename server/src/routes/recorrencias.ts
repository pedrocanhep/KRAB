import type { FastifyInstance } from 'fastify'
import { autenticar } from '../auth.ts'
import { responderErroDb } from '../errors.ts'
import { idParamSchema } from '../schemas/comum.ts'
import {
  criarRecorrenciaSchema,
  editarRecorrenciaSchema,
  listarRecorrenciasSchema,
} from '../schemas/recorrencia.ts'


export async function recorrenciasRoutes(app: FastifyInstance) {
  app.addHook('preHandler', autenticar)

  app.post('/despesas-recorrentes', async (req, reply) => {
    const body = criarRecorrenciaSchema.parse(req.body)

    const { data, error } = await req.db.rpc('criar_despesa_recorrente', {
      p_conta_id: body.conta_id,
      p_descricao: body.descricao,
      p_valor: body.valor,
      p_categoria: body.categoria,
      p_frequencia: body.frequencia,
      p_inicio: body.data_inicio,
      p_fim: body.data_fim ?? null,
    })
    if (error) return responderErroDb(reply, error)
    return reply.code(201).send(data)
  })

  // Gera as ocorrências devidas de todas as recorrências ativas do usuário (idempotente)
  app.post('/despesas-recorrentes/geracao', async (req, reply) => {
    const { data, error } = await req.db.rpc('gerar_minhas_ocorrencias')
    if (error) return responderErroDb(reply, error)
    return data
  })

  app.get('/despesas-recorrentes', async (req, reply) => {
    const f = listarRecorrenciasSchema.parse(req.query)

    let q = req.db
      .from('despesa_recorrente')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(f.offset, f.offset + f.limit - 1)
    if (f.status) q = q.eq('status', f.status)

    const { data, error, count } = await q
    if (error) return responderErroDb(reply, error)
    return { itens: data, total: count ?? 0, limit: f.limit, offset: f.offset }
  })

  app.get('/despesas-recorrentes/:id', async (req, reply) => {
    const { id } = idParamSchema.parse(req.params)

    const { data, error } = await req.db
      .from('despesa_recorrente')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) return responderErroDb(reply, error)
    if (!data) {
      return reply
        .code(404)
        .send({ erro: 'recorrencia_nao_encontrada', mensagem: 'Recorrência não encontrada.' })
    }

    const oc = await req.db
      .from('despesa')
      .select('id, descricao, valor, data_vencimento, status, data_pagamento')
      .eq('recorrencia_id', id)
      .is('deleted_at', null)
      .order('data_vencimento', { ascending: true })
      .limit(200)
    if (oc.error) return responderErroDb(reply, oc.error)

    return { ...data, ocorrencias: oc.data }
  })

  app.patch('/despesas-recorrentes/:id', async (req, reply) => {
    const { id } = idParamSchema.parse(req.params)
    const body = editarRecorrenciaSchema.parse(req.body)

    const { data, error } = await req.db.rpc('editar_despesa_recorrente', {
      p_id: id,
      p_descricao: body.descricao,
      p_valor: body.valor,
      p_categoria: body.categoria,
      p_conta_id: body.conta_id,
      p_fim: body.data_fim ?? null,
      p_limpar_fim: body.data_fim === null,
    })
    if (error) return responderErroDb(reply, error)
    return data
  })

  app.post('/despesas-recorrentes/:id/finalizacao', async (req, reply) => {
    const { id } = idParamSchema.parse(req.params)
    const { data, error } = await req.db.rpc('finalizar_despesa_recorrente', { p_id: id })
    if (error) return responderErroDb(reply, error)
    return data
  })
}
