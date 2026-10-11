import { z } from 'zod'

// Dinheiro como STRING ("1200.00"), nunca float. Até 2 casas decimais, maior que zero.
const valor = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, 'Informe um valor como "1200.00" (até 2 casas decimais).')
  .refine((v) => Number(v) > 0, 'O valor deve ser maior que zero.')

// "YYYY-MM-DD" e que exista de verdade (rejeita 2026-02-31).
const data = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`)
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
  }, 'Data inexistente.')

const descricao = z.string().trim().min(1, 'Descrição obrigatória.').max(100)
const categoria = z.string().trim().min(1, 'Categoria obrigatória.').max(50)

export const criarReceitaSchema = z
  .object({
    conta_id: z.string().uuid(),
    descricao,
    valor,
    data_recebimento: data,
    categoria,
  })
  .strict()

// conta_id NÃO pode ser alterado (.strict() rejeita o campo). Para mudar de conta: excluir e recriar.
export const editarReceitaSchema = z
  .object({
    descricao: descricao.optional(),
    valor: valor.optional(),
    data_recebimento: data.optional(),
    categoria: categoria.optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, 'Informe ao menos um campo para alterar.')

export const idParamSchema = z.object({ id: z.string().uuid() })

export const listarReceitasSchema = z
  .object({
    conta_id: z.string().uuid().optional(),
    de: data.optional(),
    ate: data.optional(),
    situacao: z.enum(['ativas', 'excluidas', 'todas']).default('ativas'),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .refine((o) => !o.de || !o.ate || o.de <= o.ate, {
    message: 'Intervalo de datas inválido.',
    path: ['de'],
  })

// Chave opcional do cabeçalho Idempotency-Key (use um UUID gerado pelo cliente).
export const chaveIdempotenciaSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{8,100}$/, 'Idempotency-Key deve ter de 8 a 100 caracteres (letras, números, - e _).')
  .optional()
