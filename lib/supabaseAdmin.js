import { createClient } from '@supabase/supabase-js';

// Usa a service_role key — só roda no servidor (server actions / API routes).
// Nunca importar isso em um componente 'use client'.
let client;

export function supabaseAdmin() {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
  }
  return client;
}
