import { z } from 'zod'
import { dataSchema } from './comum.ts'

// Histórico de saldo. Diferente do extrato, NÃO assume os últimos 30 dias: sem datas, lista tudo.
export const listarMovimentacoesSchema = z
  .object({
    conta_id: z.string().uuid().optional(),
    de: dataSchema.optional(),
    ate: dataSchema.optional(),
    origem: z.enum(['todas', 'receita', 'despesa', 'ajuste']).default('todas'),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .refine((o) => !o.de || !o.ate || o.de <= o.ate, {
    message: 'Intervalo de datas inválido.',
    path: ['de'],
  })
