-- Compartir un ciclo — compatible con la versión publicada (tabla y función
-- nuevas).

-- 1 · Enlaces de sólo lectura. El token es lo único que viaja en la URL: 32
-- caracteres al azar, imposible de adivinar. Se puede revocar.
create table if not exists public.cycle_shares (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cycle_id bigint not null references public.cycles(id) on delete cascade,
  token text not null unique check (length(token) >= 24),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists cycle_shares_cycle_idx on public.cycle_shares (cycle_id);
create index if not exists cycle_shares_user_idx on public.cycle_shares (user_id);

alter table public.cycle_shares enable row level security;

drop policy if exists "cycle_shares: ver los propios" on public.cycle_shares;
drop policy if exists "cycle_shares: crear sobre lo propio" on public.cycle_shares;
drop policy if exists "cycle_shares: modificar los propios" on public.cycle_shares;
drop policy if exists "cycle_shares: borrar los propios" on public.cycle_shares;

create policy "cycle_shares: ver los propios" on public.cycle_shares
  for select to authenticated using (user_id = (select auth.uid()));
create policy "cycle_shares: crear sobre lo propio" on public.cycle_shares
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.cycles c where c.id = cycle_shares.cycle_id and c.user_id = (select auth.uid()))
  );
create policy "cycle_shares: modificar los propios" on public.cycle_shares
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "cycle_shares: borrar los propios" on public.cycle_shares
  for delete to authenticated using (user_id = (select auth.uid()));

-- 2 · Lo que ve quien tiene el enlace. Es SECURITY DEFINER porque quien mira
-- no tiene sesión (y la RLS no le dejaría ver nada); por eso devuelve sólo
-- columnas elegidas de ese ciclo, nunca ids de usuario, notas privadas de la
-- bitácora ni datos de otros ciclos. Un token revocado o inexistente da null.
create or replace function public.get_shared_cycle(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_share record;
  v_result jsonb;
begin
  if p_token is null or length(p_token) < 24 then
    return null;
  end if;

  select s.cycle_id, s.user_id into v_share
    from public.cycle_shares s
   where s.token = p_token and s.revoked_at is null;

  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'cycle', (
      select jsonb_build_object(
        'name', c.name, 'start_date', c.start_date, 'is_active', c.is_active,
        'space', (select jsonb_build_object('name', sp.name, 'type', sp.type, 'area_m2', sp.area_m2,
                                            'width', sp.width, 'length', sp.length, 'light_watts', sp.light_watts)
                    from public.spaces sp where sp.id = c.space_id)
      )
      from public.cycles c where c.id = v_share.cycle_id and c.user_id = v_share.user_id
    ),
    'plants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'strain', p.strain, 'breeder', p.breeder, 'stage', p.stage,
        'source_type', p.source_type, 'is_archived', p.is_archived, 'planted_at', p.planted_at,
        'stage_updated_at', p.stage_updated_at, 'image_url', p.image_url,
        'date_germinacion', p.date_germinacion, 'date_plantula', p.date_plantula,
        'date_enraizamiento', p.date_enraizamiento, 'date_vegetativo', p.date_vegetativo,
        'date_floracion', p.date_floracion, 'date_secado', p.date_secado, 'date_curado', p.date_curado
      ) order by p.id)
      from public.plants p where p.cycle_id = v_share.cycle_id and p.user_id = v_share.user_id
    ), '[]'::jsonb),
    'measurements', coalesce((
      select jsonb_agg(jsonb_build_object('date', m.date, 'created_at', m.created_at, 'temperature', m.temperature, 'humidity', m.humidity) order by m.date, m.created_at)
      from (
        select * from public.measurements m
         where m.cycle_id = v_share.cycle_id and m.user_id = v_share.user_id
         order by m.date desc, m.created_at desc
         limit 120
      ) m
    ), '[]'::jsonb),
    'images', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'public_url', i.public_url, 'taken_at', i.taken_at, 'created_at', i.created_at, 'description', i.description) order by i.taken_at)
      from public.cycle_images i where i.cycle_id = v_share.cycle_id
    ), '[]'::jsonb),
    'harvests', coalesce((
      select jsonb_agg(jsonb_build_object('plant_id', h.plant_id, 'harvested_on', h.harvested_on, 'dried_on', h.dried_on, 'wet_g', h.wet_g, 'dry_g', h.dry_g))
      from public.harvests h where h.cycle_id = v_share.cycle_id and h.user_id = v_share.user_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.get_shared_cycle(text) from public;
grant execute on function public.get_shared_cycle(text) to anon, authenticated;
