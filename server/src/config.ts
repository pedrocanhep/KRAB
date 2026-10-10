function exigir(nome: string): string {
  const valor = process.env[nome]
  if (!valor) throw new Error(`Variável de ambiente ausente: ${nome} (veja .env.example)`)
  return valor
}

export const config = {
  port: Number(process.env.PORT ?? 3333),
  supabaseUrl: exigir('SUPABASE_URL'),
  supabaseAnonKey: exigir('SUPABASE_ANON_KEY'),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
}
