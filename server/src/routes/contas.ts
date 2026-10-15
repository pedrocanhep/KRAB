import type { FastifyInstance } from 'fastify'
import { autenticar } from '../auth.ts'
import { responderErroDb } from '../errors.ts'
import { idParamSchema } from '../schemas/comum.ts'
import { criarContaSchema, editarContaSchema, listarContasSchema } from '../schemas/conta.ts'

// Na edição, null significa "limpar o campo" e o banco entende '' como limpar.
// Campo ausente (undefined) não vai no JSON e o banco entende como "não mexe".
const limpar = (v: string | null | undefined) => (v === null ? '' : v)

export async function contasRoutes(app: FastifyInstance) {
  app.addHook('preHandler', autenticar)

  // Criar (com saldo inicial opcional, registrado no ledger como 'ajuste')
  app.post('/contas', async (req, reply) => {
    const body = criarContaSchema.parse(req.body)

    const { data, error } = await req.db.rpc('criar_conta', {
      p_nome: body.nome,
      p_tipo: body.tipo,
      p_saldo_inicial: body.saldo_inicial,
      p_cod_banco: body.cod_banco ?? null,
      p_agencia: body.agencia ?? null,
      p_num_conta: body.num_conta ?? null,
      p_digito: body.digito_verificador ?? null,
    })
    if (error) return responderErroDb(reply, error)
    return reply.code(201).send(data)
  })

  // Listar (leitura direta; o RLS garante que só vêm as contas do usuário)
  app.get('/contas', async (req, reply) => {
    const f = listarContasSchema.parse(req.query)

    let q = req.db
      .from('conta')
      .select('*', { count: 'exact' })
      .order('nome', { ascending: true })
      .range(f.offset, f.offset + f.limit - 1)

    if (f.situacao === 'ativas') q = q.is('deleted_at', null)
    if (f.situacao === 'excluidas') q = q.not('deleted_at', 'is', null)
    if (f.tipo) q = q.eq('tipo', f.tipo)

    const { data, error, count } = await q
    if (error) return responderErroDb(reply, error)
    return { itens: data, total: count ?? 0, limit: f.limit, offset: f.offset }
  })

  // Detalhe + últimas 20 movimentações do saldo
  app.get('/contas/:id', async (req, reply) => {
    const { id } = idParamSchema.parse(req.params)

    const { data, error } = await req.db.from('conta').select('*').eq('id', id).maybeSingle()
    if (error) return responderErroDb(reply, error)
    if (!data) {
      return reply.code(404).send({ erro: 'conta_nao_encontrada', mensagem: 'Conta não encontrada.' })
    }

    const mov = await req.db
      .from('movimentacao_conta')
      .select('id, valor, origem_tipo, origem_id, motivo, created_at')
      .eq('conta_id', id)
      .order('id', { ascending: false })
      .limit(20)
    if (mov.error) return responderErroDb(reply, mov.error)

    return { ...data, ultimas_movimentacoes: mov.data }
  })

  // Editar dados cadastrais (nunca o saldo)
  app.patch('/contas/:id', async (req, reply) => {
    const { id } = idParamSchema.parse(req.params)
    const body = editarContaSchema.parse(req.body)

    const { data, error } = await req.db.rpc('editar_conta', {
      p_id: id,
      p_nome: body.nome,
      p_tipo: body.tipo,
      p_cod_banco: limpar(body.cod_banco),
      p_agencia: limpar(body.agencia),
      p_num_conta: limpar(body.num_conta),
      p_digito: limpar(body.digito_verificador),
    })
    if (error) return responderErroDb(reply, error)
    return data
  })

  // Exclusão lógica (bloqueada se houver despesa pendente)
  app.delete('/contas/:id', async (req, reply) => {
    const { id } = idParamSchema.parse(req.params)
    const { data, error } = await req.db.rpc('excluir_conta', { p_id: id })
    if (error) return responderErroDb(reply, error)
    return data
  })

  // Restaurar
  app.post('/contas/:id/restauracao', async (req, reply) => {
    const { id } = idParamSchema.parse(req.params)
    const { data, error } = await req.db.rpc('restaurar_conta', { p_id: id })
    if (error) return responderErroDb(reply, error)
    return data
  })
}
