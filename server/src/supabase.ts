import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from './config.ts'

export function clienteDoUsuario(token: string): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
