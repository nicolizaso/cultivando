import { cache } from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';

/**
 * El cliente de Supabase con la sesión de quien hace el pedido.
 *
 * Con `cache` se arma uno solo por pedido: el layout, la página y sus
 * componentes comparten el mismo, en vez de leer las cookies y armar uno cada
 * uno. Fuera de un render (por ejemplo en una Server Action) `cache` no
 * guarda nada y cada llamada arma el suyo, que es lo de siempre.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // El método setAll fue llamado desde un Server Component.
            // Se puede ignorar: el proxy (proxy.ts) es el que refresca la sesión.
          }
        },
      },
    }
  );
});
