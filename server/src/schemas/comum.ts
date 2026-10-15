import { z } from 'zod'


export const valorSchema = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, 'Informe um valor como "1200.00" (até 2 casas decimais).')
  .refine((v) => Number(v) > 0, 'O valor deve ser maior que zero.')

export const dataSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`)
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
  }, 'Data inexistente.')

export const descricaoSchema = z.string().trim().min(1, 'Descrição obrigatória.').max(100)
export const categoriaSchema = z.string().trim().min(1, 'Categoria obrigatória.').max(50)

export const idParamSchema = z.object({ id: z.string().uuid() })

export const chaveIdempotenciaSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{8,100}$/, 'Idempotency-Key deve ter de 8 a 100 caracteres (letras, números, - e _).')
  .optional()
