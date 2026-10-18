import { cache } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from './supabase-server';

export type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

export interface Session {
  supabase: ServerSupabase;
  user: User;
}

export const NOT_SIGNED_IN = 'Tu sesión venció. Volvé a iniciar sesión.';

/**
 * Abre una Server Action: devuelve el cliente con la sesión del usuario, o un
 * error si no hay sesión.
 *
 * Una Server Action es un endpoint público: aunque la RLS ya filtra por
 * dueño, sin este chequeo una llamada sin sesión llegaba hasta la base y
 * volvía con un error crudo en vez de un mensaje claro.
 */
export async function requireUser(): Promise<Session | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: NOT_SIGNED_IN };
  return { supabase: await createClient(), user };
}

/**
 * Quién hace el pedido, verificado contra Supabase Auth, o null.
 *
 * `getUser()` es una consulta de red: antes el layout y la página la hacían
 * cada uno por su lado en cada navegación. Con `cache` se hace una sola vez
 * por pedido y la comparten todos los componentes de servidor.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
