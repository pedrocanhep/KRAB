import { z } from 'zod'

// O perfil guarda só o nome exibido na tela ("Olá, nome"). O id do usuário vem do token,
// nunca do corpo da requisição; por isso .strict() rejeita user_id e qualquer outro campo.
export const salvarPerfilSchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(1, 'Nome obrigatório.')
      .max(80, 'Nome com no máximo 80 caracteres.'),
  })
  .strict()
