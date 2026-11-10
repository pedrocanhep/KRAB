import { z } from 'zod'
import { hojeSaoPaulo } from './relatorio.ts'

const valor = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, 'Informe um valor como "1200.00" (até 2 casas decimais).')
  .refine((v) => Number(v) > 0, 'O valor deve ser maior que zero.')

const data = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`)
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
  }, 'Data inexistente.')

const descricao = z.string().trim().min(1, 'Descrição obrigatória.').max(100)
const categoria = z.string().trim().min(1, 'Categoria obrigatória.').max(50)
// alteração Pedro: a data era validada apenas quanto ao formato e existência; agora também não pode superar hoje em São Paulo.
const dataRecebimento = data.refine(
  (v) => v <= hojeSaoPaulo(),
  'A data de recebimento não pode ser futura.',
)

export const criarReceitaSchema = z
  .object({
    conta_id: z.string().uuid(),
    descricao,
    valor,
    // alteração Pedro: a criação aceitava recebimento futuro; agora usa a validação de data não futura.
    data_recebimento: dataRecebimento,
    categoria,
  })
  .strict()

export const editarReceitaSchema = z
  .object({
    descricao: descricao.optional(),
    valor: valor.optional(),
    // alteração Pedro: a edição aceitava recebimento futuro; agora aplica a mesma validação da criação.
    data_recebimento: dataRecebimento.optional(),
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

export const chaveIdempotenciaSchema = z
  .string()
  .regex(
    /^[A-Za-z0-9_-]{8,100}$/,
    'Idempotency-Key deve ter de 8 a 100 caracteres (letras, números, - e _).',
  )
  .optional()
