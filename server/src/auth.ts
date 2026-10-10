import type { FastifyReply, FastifyRequest } from 'fastify'
import type { SupabaseClient } from '@supabase/supabase-js'
import { clienteDoUsuario } from './supabase.ts'

declare module 'fastify' {
  interface FastifyRequest {
    db: SupabaseClient
    userId: string
  }
}

// Exige "Authorization: Bearer <JWT>" e confirma o token com o Supabase Auth.
export async function autenticar(req: FastifyRequest, reply: FastifyReply) {
  const cabecalho = req.headers.authorization
  const token = cabecalho?.startsWith('Bearer ') ? cabecalho.slice(7).trim() : ''
  if (!token) {
    return reply.code(401).send({ erro: 'nao_autenticado', mensagem: 'Token ausente.' })
  }

  const db = clienteDoUsuario(token)
  const { data, error } = await db.auth.getUser(token)
  if (error || !data.user) {
    return reply.code(401).send({ erro: 'nao_autenticado', mensagem: 'Token inválido ou expirado.' })
  }

  req.db = db
  req.userId = data.user.id
}
