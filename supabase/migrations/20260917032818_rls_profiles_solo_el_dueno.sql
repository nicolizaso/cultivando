-- 1 · profiles: dejar de publicar los emails.
-- La policy vieja daba SELECT con `using (true)` al rol `public`, es decir, a
-- cualquiera con la anon key del proyecto (que con la tienda de Vicio pasa a
-- estar en un bundle público).

drop policy if exists "Public profiles access" on public.profiles;

create policy "profiles: cada uno ve el suyo"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

-- El login por nombre de usuario (app/login/actions.ts) resolvía usuario -> email
-- leyendo `profiles` SIN sesión: al cerrar la tabla ese camino queda sin acceso y
-- todo login por usuario fallaría. Lo movemos a una función security definer que
-- devuelve UN email para UN usuario exacto, en vez de exponer la tabla entera.
--
-- Además usa igualdad case-insensitive en lugar del `.ilike()` que hacía la app:
-- ilike trata el input como PATRÓN, así que un usuario "%" devolvía el primer
-- email de la tabla.
create or replace function public.email_for_username(p_username text)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select p.email
  from public.profiles p
  where lower(p.username) = lower(trim(p_username))
  limit 1
$$;

revoke all on function public.email_for_username(text) from public;
grant execute on function public.email_for_username(text) to anon, authenticated;

comment on function public.email_for_username(text) is
  'Resuelve usuario -> email para el login. Reemplaza la lectura anónima de profiles.';
