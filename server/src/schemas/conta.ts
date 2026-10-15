import { z } from 'zod'

// Saldo inicial pode ser zero, positivo ou negativo (conta no vermelho). String, nunca float.
const saldoInicial = z
  .string()
  .regex(/^-?\d{1,12}(\.\d{1,2})?$/, 'Informe um valor como "500.00" ou "-100.00" (até 2 casas decimais).')

const nome = z.string().trim().min(1, 'Nome obrigatório.').max(50)
const tipo = z.enum(['corrente', 'poupanca', 'caixa', 'outro'])

// Campos bancários: só dígitos, nos tamanhos da documentação do projeto.
const codBanco = z.string().trim().regex(/^\d{1,4}$/, 'Código do banco: até 4 dígitos.')
const agencia = z.string().trim().regex(/^\d{1,5}$/, 'Agência: até 5 dígitos.')
const numConta = z.string().trim().regex(/^\d{1,15}$/, 'Número da conta: até 15 dígitos.')
const digito = z.string().trim().regex(/^[0-9A-Za-z]{1,2}$/, 'Dígito verificador: 1 ou 2 caracteres.')

export const criarContaSchema = z
  .object({
    nome,
    tipo: tipo.default('corrente'),
    saldo_inicial: saldoInicial.default('0.00'),
    cod_banco: codBanco.optional(),
    agencia: agencia.optional(),
    num_conta: numConta.optional(),
    digito_verificador: digito.optional(),
  })
  .strict()

// O saldo NÃO pode ser editado aqui (.strict() rejeita saldo_disponivel e saldo_inicial).
// Para LIMPAR um campo bancário, envie null.
export const editarContaSchema = z
  .object({
    nome: nome.optional(),
    tipo: tipo.optional(),
    cod_banco: codBanco.nullable().optional(),
    agencia: agencia.nullable().optional(),
    num_conta: numConta.nullable().optional(),
    digito_verificador: digito.nullable().optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, 'Informe ao menos um campo para alterar.')

export const listarContasSchema = z.object({
  tipo: tipo.optional(),
  situacao: z.enum(['ativas', 'excluidas', 'todas']).default('ativas'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
