import { z } from 'zod'
import {
  categoriaSchema as categoria,
  dataSchema as data,
  descricaoSchema as descricao,
  valorSchema as valor,
} from './comum.ts'

const frequencia = z.enum(['diaria', 'semanal', 'mensal'])

export const criarRecorrenciaSchema = z
  .object({
    conta_id: z.string().uuid(),
    descricao,
    valor,
    categoria,
    frequencia,
    data_inicio: data,
    data_fim: data.optional(),
  })
  .strict()
  .refine((o) => !o.data_fim || o.data_fim >= o.data_inicio, {
    message: 'A data final não pode ser anterior à data de início.',
    path: ['data_fim'],
  })

// Frequência e data de início NÃO mudam (finalize e crie outra). data_fim: null remove o fim.
export const editarRecorrenciaSchema = z
  .object({
    descricao: descricao.optional(),
    valor: valor.optional(),
    categoria: categoria.optional(),
    conta_id: z.string().uuid().optional(),
    data_fim: data.nullable().optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, 'Informe ao menos um campo para alterar.')

export const listarRecorrenciasSchema = z.object({
  status: z.enum(['ativa', 'finalizada']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
