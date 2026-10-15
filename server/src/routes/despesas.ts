import type { FastifyInstance } from 'fastify'
import { autenticar } from '../auth.ts'
import { responderErroDb } from '../errors.ts'
import { chaveIdempotenciaSchema, idParamSchema } from '../schemas/comum.ts'
import {
  criarDespesaSchema,
  editarDespesaSchema,
  listarDespesasSchema,
  pagarDespesaSchema,
} from '../schemas/despesa.ts'


export async function despesasRoutes(app: FastifyInstance) {
  app.addHook('preHandler', autenticar)

  app.post('/despesas', async (req, reply) => {
    const body = criarDespesaSchema.parse(req.body)
    const chave = chaveIdempotenciaSchema.parse(req.headers['idempotency-key'])

    const { data, error } = await req.db.rpc('criar_despesa', {
      p_conta_id: body.conta_id,
      p_descricao: body.descricao,
      p_valor: body.valor,
      p_vencimento: body.data_vencimento,
      p_categoria: body.categoria,
      p_chave: chave ?? null,
    })
    if (error) return responderErroDb(reply, error)
    return reply.code(201).send(data)
  })

  app.get('/despesas', async (req, reply) => {
    const f = listarDespesasSchema.parse(req.query)

    let q = req.db
      .from('despesa')
      .select('*', { count: 'exact' })
      .order('data_vencimento', { ascending: true })
      .order('created_at', { ascending: false })
      .range(f.offset, f.offset + f.limit - 1)

    if (f.situacao === 'ativas') q = q.is('deleted_at', null)
    if (f.situacao === 'excluidas') q = q.not('deleted_at', 'is', null)
    if (f.status) q = q.eq('status', f.status)
    if (f.conta_id) q = q.eq('conta_id', f.conta_id)
    if (f.categoria) q = q.eq('categoria', f.categoria)
    if (f.de) q = q.gte('data_vencimento', f.de)
    if (f.ate) q = q.lte('data_vencimento', f.ate)

    const { data, error, count } = await q
    if (error) return responderErroDb(reply, error)
    return { itens: data, total: count ?? 0, limit: f.limit, offset: f.offset }
  })

  app.get('/despesas/:id', async (req, reply) => {
    const { id } = idParamSchema.parse(req.params)

    const { data, error } = await req.db.from('despesa').select('*').eq('id', id).maybeSingle()
    if (error) return responderErroDb(reply, error)
    if (!data) {
      return reply.code(404).send({ erro: 'despesa_nao_encontrada', mensagem: 'Despesa não encontrada.' })
    }

    const hist = await req.db
      .from('movimentacao_conta')
      .select('id, valor, motivo, created_at')
      .eq('origem_tipo', 'despesa')
      .eq('origem_id', id)
      .order('id', { ascending: true })
    if (hist.error) return responderErroDb(reply, hist.error)

    return { ...data, historico: hist.data }
  })

  app.patch('/despesas/:id', async (req, reply) => {
    const { id } = idParamSchema.parse(req.params)
    const body = editarDespesaSchema.parse(req.body)

    const { data, error } = await req.db.rpc('editar_despesa', {
      p_id: id,
      p_descricao: body.descricao,
      p_valor: body.valor,
      p_vencimento: body.data_vencimento,
      p_categoria: body.categoria,
      p_conta_id: body.conta_id,
    })
    if (error) return responderErroDb(reply, error)
    return data
  })

 
  app.post('/despesas/:id/pagamento', async (req, reply) => {
    const { id } = idParamSchema.parse(req.params)
    const body = pagarDespesaSchema.parse(req.body ?? {})

    const { data, error } = await req.db.rpc('pagar_despesa', {
      p_id: id,
      p_data: body.data_pagamento ?? null,
    })
    if (error) return responderErroDb(reply, error)
    return data
  })

  app.delete('/despesas/:id', async (req, reply) => {
    const { id } = idParamSchema.parse(req.params)
    const { data, error } = await req.db.rpc('excluir_despesa', { p_id: id })
    if (error) return responderErroDb(reply, error)
    return data
  })

  app.post('/despesas/:id/restauracao', async (req, reply) => {
    const { id } = idParamSchema.parse(req.params)
    const { data, error } = await req.db.rpc('restaurar_despesa', { p_id: id })
    if (error) return responderErroDb(reply, error)
    return data
  })
}
