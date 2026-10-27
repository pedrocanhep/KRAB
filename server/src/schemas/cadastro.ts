import { z } from 'zod'

// Regra de senha do cadastro. O Supabase também tem um mínimo próprio (Authentication, Sign In /
// Providers, "Minimum password length"): deixe os dois iguais.
export const SENHA_MINIMA = 8
// O Supabase usa bcrypt, que só considera os primeiros 72 bytes da senha.
export const SENHA_MAXIMA_BYTES = 72

const nome = z
  .string()
  .trim()
  .min(1, 'Nome obrigatório.')
  .max(80, 'Nome com no máximo 80 caracteres.')

// E-mail sem espaços nas pontas e em minúsculas, para não criar dois cadastros do mesmo endereço.
const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'E-mail muito longo.')
  .email('E-mail inválido.')

// A senha é usada exatamente como digitada (sem trim).
const senha = z
  .string()
  .min(SENHA_MINIMA, `A senha deve ter no mínimo ${SENHA_MINIMA} caracteres.`)
  .refine(
    (s) => Buffer.byteLength(s, 'utf8') <= SENHA_MAXIMA_BYTES,
    `A senha deve ter no máximo ${SENHA_MAXIMA_BYTES} caracteres.`,
  )

export const cadastroSchema = z
  .object({
    nome,
    email,
    password: senha,
    confirmar_senha: z.string(),
  })
  .strict()
  .refine((o) => o.password === o.confirmar_senha, {
    message: 'As senhas não conferem.',
    path: ['confirmar_senha'],
  })

export const reenviarConfirmacaoSchema = z.object({ email }).strict()
