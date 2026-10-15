import { z } from 'zod'
import {
  categoriaSchema as categoria,
  dataSchema as data,
  descricaoSchema as descricao,
  valorSchema as valor,
} from './comum.ts'

export const criarDespesaSchema = z
  .object({
    conta_id: z.string().uuid(),
    descricao,
    valor,
    data_vencimento: data,
    categoria,
  })
  .strict()

export const editarDespesaSchema = z
  .object({
    descricao: descricao.optional(),
    valor: valor.optional(),
    data_vencimento: data.optional(),
    categoria: categoria.optional(),
    conta_id: z.string().uuid().optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, 'Informe ao menos um campo para alterar.')

export const pagarDespesaSchema = z
  .object({
    data_pagamento: data.optional(),
  })
  .strict()

export const listarDespesasSchema = z
  .object({
    conta_id: z.string().uuid().optional(),
    status: z.enum(['pendente', 'paga']).optional(),
    categoria: z.string().trim().min(1).max(50).optional(),
    de: data.optional(),   // filtram por data de vencimento
    ate: data.optional(),
    situacao: z.enum(['ativas', 'excluidas', 'todas']).default('ativas'),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .refine((o) => !o.de || !o.ate || o.de <= o.ate, {
    message: 'Intervalo de datas inválido.',
    path: ['de'],
  })
