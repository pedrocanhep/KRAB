import type { FastifyInstance } from 'fastify'
import { autenticar } from '../auth.ts'
import { responderErroDb } from '../errors.ts'
import {
  chaveIdempotenciaSchema,
  criarReceitaSchema,
  editarReceitaSchema,
  idParamSchema,
  listarReceitasSchema,
} from '../schemas/receita.ts'

export async function receitasRoutes(app: FastifyInstance) {
  app.addHook('preHandler', autenticar)

  // Criar (efeito no saldo: + valor, uma única vez)
  app.post('/receitas', async (req, reply) => {
    const body = criarReceitaSchema.parse(req.body)
    const chave = chaveIdempotenciaSchema.parse(req.headers['idempotency-key'])

    const { data, error } = await req.db.rpc('criar_receita', {
      p_conta_id: body.conta_id,
      p_descricao: body.descricao,
      p_valor: body.valor,
      p_data: body.data_recebimento,
      p_categoria: body.categoria,
      p_chave: chave ?? null,
    })
    if (error) return responderErroDb(reply, error)
    return reply.code(201).send(data)
  })

  // Listar (leitura direta; o RLS garante que só vêm as linhas do usuário)
  app.get('/receitas', async (req, reply) => {
    const f = listarReceitasSchema.parse(req.query)

    let q = req.db
      .from('receita')
      .select('*', { count: 'exact' })
      .order('data_recebimento', { ascending: false })
      .order('created_at', { ascending: false })
      .range(f.offset, f.offset + f.limit - 1)

    if (f.situacao === 'ativas') q = q.is('deleted_at', null)
    if (f.situacao === 'excluidas') q = q.not('deleted_at', 'is', null)
    if (f.conta_id) q = q.eq('conta_id', f.conta_id)
    if (f.de) q = q.gte('data_recebimento', f.de)
    if (f.ate) q = q.lte('data_recebimento', f.ate)

    const { data, error, count } = await q
    if (error) return responderErroDb(reply, error)
    return { itens: data, total: count ?? 0, limit: f.limit, offset: f.offset }
  })

  // Detalhe + histórico de lançamentos no saldo
  app.get('/receitas/:id', async (req, reply) => {
    const { id } = idParamSchema.parse(req.params)

    const { data, error } = await req.db.from('receita').select('*').eq('id', id).maybeSingle()
    if (error) return responderErroDb(reply, error)
    if (!data) {
      return reply.code(404).send({ erro: 'receita_nao_encontrada', mensagem: 'Receita não encontrada.' })
    }

    const hist = await req.db
      .from('movimentacao_conta')
      .select('id, valor, motivo, created_at')
      .eq('origem_tipo', 'receita')
      .eq('origem_id', id)
      .order('id', { ascending: true })
    if (hist.error) return responderErroDb(reply, hist.error)

    return { ...data, historico: hist.data }
  })

  // Editar (ajusta o saldo pela diferença)
  app.patch('/receitas/:id', async (req, reply) => {
    const { id } = idParamSchema.parse(req.params)
    const body = editarReceitaSchema.parse(req.body)

    const { data, error } = await req.db.rpc('editar_receita', {
      p_id: id,
      p_descricao: body.descricao,
      p_valor: body.valor,
      p_data: body.data_recebimento,
      p_categoria: body.categoria,
    })
    if (error) return responderErroDb(reply, error)
    return data
  })

  // Exclusão lógica (estorna o saldo)
  app.delete('/receitas/:id', async (req, reply) => {
    const { id } = idParamSchema.parse(req.params)
    const { data, error } = await req.db.rpc('excluir_receita', { p_id: id })
    if (error) return responderErroDb(reply, error)
    return data
  })

  // Restaurar (reaplica o saldo)
  app.post('/receitas/:id/restauracao', async (req, reply) => {
    const { id } = idParamSchema.parse(req.params)
    const { data, error } = await req.db.rpc('restaurar_receita', { p_id: id })
    if (error) return responderErroDb(reply, error)
    return data
  })
}
