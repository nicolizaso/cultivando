import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * Cliente con la clave de servicio: saltea la RLS, así que sólo vive en el
 * servidor (`server-only` hace fallar el build si algo del navegador lo
 * importa) y sólo se usa para lo que la sesión del usuario no puede hacer,
 * como resolver usuario → email antes de iniciar sesión.
 *
 * Devuelve null si falta la clave, para que quien llama degrade con un
 * mensaje en vez de romperse.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
