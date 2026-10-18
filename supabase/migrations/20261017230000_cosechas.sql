-- Cosechas — compatible con la versión publicada (tabla nueva).

-- Una fila por planta cosechada: el peso húmedo al cortar y el seco al
-- terminar el secado (se completa después). El ciclo se guarda como estaba
-- al cosechar, para que el rendimiento del ciclo no cambie si la planta se
-- mueve o se archiva.
create table if not exists public.harvests (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plant_id bigint not null unique references public.plants(id) on delete cascade,
  cycle_id bigint references public.cycles(id) on delete set null,
  harvested_on date not null,
  dried_on date,
  wet_g numeric check (wet_g is null or (wet_g >= 0 and wet_g <= 100000)),
  dry_g numeric check (dry_g is null or (dry_g >= 0 and dry_g <= 100000)),
  rating smallint check (rating is null or rating between 1 and 5),
  notes text check (notes is null or length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (dried_on is null or dried_on >= harvested_on)
);

create index if not exists harvests_user_idx on public.harvests (user_id);
create index if not exists harvests_cycle_idx on public.harvests (cycle_id);

alter table public.harvests enable row level security;

drop policy if exists "harvests: ver las propias" on public.harvests;
drop policy if exists "harvests: crear sobre lo propio" on public.harvests;
drop policy if exists "harvests: modificar las propias" on public.harvests;
drop policy if exists "harvests: borrar las propias" on public.harvests;

create policy "harvests: ver las propias" on public.harvests
  for select to authenticated using (user_id = (select auth.uid()));

-- La planta (y el ciclo, si hay) tienen que ser del usuario.
create policy "harvests: crear sobre lo propio" on public.harvests
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.plants p where p.id = harvests.plant_id and p.user_id = (select auth.uid()))
    and (harvests.cycle_id is null or exists (select 1 from public.cycles c where c.id = harvests.cycle_id and c.user_id = (select auth.uid())))
  );

create policy "harvests: modificar las propias" on public.harvests
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.plants p where p.id = harvests.plant_id and p.user_id = (select auth.uid()))
    and (harvests.cycle_id is null or exists (select 1 from public.cycles c where c.id = harvests.cycle_id and c.user_id = (select auth.uid())))
  );

create policy "harvests: borrar las propias" on public.harvests
  for delete to authenticated using (user_id = (select auth.uid()));
