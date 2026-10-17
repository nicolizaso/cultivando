-- Stock de fertilizantes — compatible con la versión publicada (columnas
-- nuevas que admiten null y una tabla nueva).

-- 1 · Cuánto queda de cada producto. Null = no se lleva la cuenta.
alter table public.fertilizers add column if not exists stock_ml numeric;
alter table public.fertilizers add column if not exists container_ml numeric;
alter table public.fertilizers add column if not exists low_stock_ml numeric;

alter table public.fertilizers drop constraint if exists fertilizers_stock_check;
alter table public.fertilizers add constraint fertilizers_stock_check check (
  (stock_ml is null or stock_ml >= 0)
  and (container_ml is null or container_ml > 0)
  and (low_stock_ml is null or low_stock_ml >= 0)
);

-- 2 · Cada entrada y salida, para saber por qué el número es el que es.
create table if not exists public.fertilizer_movements (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fertilizer_id bigint not null references public.fertilizers(id) on delete cascade,
  -- Positivo entra (compra), negativo sale (uso).
  delta_ml numeric not null,
  reason text not null check (reason in ('compra', 'uso', 'ajuste')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists fertilizer_movements_fertilizer_idx on public.fertilizer_movements (fertilizer_id, created_at desc);
create index if not exists fertilizer_movements_user_idx on public.fertilizer_movements (user_id);

alter table public.fertilizer_movements enable row level security;

drop policy if exists "fertilizer_movements: ver los propios" on public.fertilizer_movements;
create policy "fertilizer_movements: ver los propios" on public.fertilizer_movements
  for select to authenticated using (user_id = (select auth.uid()));
-- Se escriben con la función de abajo, que además mueve el stock. Corre con
-- los permisos del usuario, así que necesita poder insertar: sólo sobre sus
-- propios productos.
drop policy if exists "fertilizer_movements: crear sobre lo propio" on public.fertilizer_movements;
create policy "fertilizer_movements: crear sobre lo propio" on public.fertilizer_movements
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.fertilizers f
       where f.id = fertilizer_movements.fertilizer_id and f.user_id = (select auth.uid())
    )
  );

-- 3 · Mover el stock: suma o resta y deja el movimiento, todo junto.
-- p_changes: [{ fertilizer_id, delta_ml }]. Un producto sin stock cargado
-- (null) se saltea: no se lleva su cuenta. El stock nunca baja de cero.
create or replace function public.move_fertilizer_stock(
  p_changes jsonb,
  p_reason text,
  p_note text default null
)
returns table (fertilizer_id bigint, name text, stock_ml numeric, low boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_change record;
begin
  if v_uid is null then
    raise exception 'Hace falta iniciar sesión' using errcode = '42501';
  end if;
  if p_reason not in ('compra', 'uso', 'ajuste') then
    raise exception 'Motivo inválido' using errcode = '22023';
  end if;
  if jsonb_typeof(p_changes) is distinct from 'array' then
    raise exception 'No hay cambios' using errcode = '22023';
  end if;

  for v_change in
    select (c->>'fertilizer_id')::bigint as id, (c->>'delta_ml')::numeric as delta
      from jsonb_array_elements(p_changes) as c
  loop
    if v_change.delta is null or v_change.delta = 0 then
      continue;
    end if;

    update public.fertilizers f
       set stock_ml = greatest(0, f.stock_ml + v_change.delta)
     where f.id = v_change.id
       and f.user_id = v_uid
       and f.stock_ml is not null;

    if found then
      insert into public.fertilizer_movements (user_id, fertilizer_id, delta_ml, reason, note)
      values (v_uid, v_change.id, v_change.delta, p_reason, nullif(btrim(coalesce(p_note, '')), ''));
    end if;
  end loop;

  return query
    select f.id, f.name, f.stock_ml, (f.stock_ml is not null and f.low_stock_ml is not null and f.stock_ml <= f.low_stock_ml)
      from public.fertilizers f
     where f.user_id = v_uid
       and f.id in (select (c->>'fertilizer_id')::bigint from jsonb_array_elements(p_changes) as c);
end;
$$;

revoke execute on function public.move_fertilizer_stock(jsonb, text, text) from public, anon;
grant execute on function public.move_fertilizer_stock(jsonb, text, text) to authenticated;
