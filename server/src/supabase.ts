import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from './config.ts'

// Cliente "em nome do usuário": usa a chave anon + o JWT dele.
// Assim o banco enxerga auth.uid() e as regras de RLS valem de verdade.
export function clienteDoUsuario(token: string): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
