import { z } from 'zod'
import { dataSchema } from './comum.ts'

// "Hoje" no fuso de São Paulo, no formato AAAA-MM-DD.
export const hojeSaoPaulo = (): string =>
  new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })

export const somarDias = (iso: string, dias: number): string => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

const msgIntervalo = { message: 'Intervalo de datas inválido.', path: ['de'] }

// Período padrão: últimos 30 dias (de = hoje - 29, ate = hoje), como no mockup.
export const extratoSchema = z
  .object({
    de: dataSchema.optional(),
    ate: dataSchema.optional(),
    conta_id: z.string().uuid().optional(),
    tipo: z.enum(['todos', 'receitas', 'despesas']).default('todos'),
    ordem: z.enum(['data', 'categoria']).default('data'),
    limit: z.coerce.number().int().min(1).max(500).default(100),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .transform((o) => {
    const ate = o.ate ?? hojeSaoPaulo()
    return { ...o, ate, de: o.de ?? somarDias(ate, -29) }
  })
  .refine((o) => o.de <= o.ate, msgIntervalo)

export const relatorioSchema = z
  .object({
    de: dataSchema.optional(),
    ate: dataSchema.optional(),
    conta_id: z.string().uuid().optional(),
  })
  .transform((o) => {
    const ate = o.ate ?? hojeSaoPaulo()
    return { ...o, ate, de: o.de ?? somarDias(ate, -29) }
  })
  .refine((o) => o.de <= o.ate, msgIntervalo)
