-- Tareas — compatible con la versión publicada (sólo agrega funciones).

-- 1 · Crear una tarea (o una serie) con sus ciclos y plantas en una sola
-- transacción. Antes se insertaban las tareas y después, aparte, las tablas de
-- cruce: si lo segundo fallaba, la tarea quedaba sin objetivo y la acción
-- igual decía "Tarea agendada". También eran N consultas por objetivo.
--
-- Corre con los permisos de quien la llama (la RLS sigue mandando) y sólo
-- enlaza ciclos y plantas del propio usuario.
create or replace function public.create_tasks(
  p_tasks jsonb,
  p_cycle_ids bigint[],
  p_plant_ids bigint[]
)
returns bigint[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ids bigint[];
begin
  if v_uid is null then
    raise exception 'Hace falta iniciar sesión' using errcode = '42501';
  end if;

  if jsonb_typeof(p_tasks) is distinct from 'array' or jsonb_array_length(p_tasks) = 0 then
    raise exception 'No hay tareas para crear' using errcode = '23514';
  end if;

  if jsonb_array_length(p_tasks) > 200 then
    raise exception 'Demasiadas tareas en una sola serie' using errcode = '23514';
  end if;

  with inserted as (
    insert into public.tasks (
      user_id, title, description, due_date, type, application_type,
      target_stage, target_space_id, status, recurrence_id, metadata
    )
    select
      v_uid,
      t->>'title',
      nullif(t->>'description', ''),
      (t->>'due_date')::timestamptz,
      t->>'type',
      nullif(t->>'application_type', ''),
      nullif(t->>'target_stage', ''),
      nullif(t->>'target_space_id', '')::bigint,
      'pending',
      nullif(t->>'recurrence_id', '')::uuid,
      t->'metadata'
    from jsonb_array_elements(p_tasks) as t
    returning id
  )
  select array_agg(id order by id) into v_ids from inserted;

  insert into public.task_cycles (task_id, cycle_id)
  select task_id, c.id
    from unnest(v_ids) as task_id
   cross join (
     select distinct cycle.id
       from public.cycles cycle
      where cycle.id = any (coalesce(p_cycle_ids, '{}'))
        and cycle.user_id = v_uid
   ) as c;

  insert into public.task_plants (task_id, plant_id)
  select task_id, p.id
    from unnest(v_ids) as task_id
   cross join (
     select distinct plant.id
       from public.plants plant
      where plant.id = any (coalesce(p_plant_ids, '{}'))
        and plant.user_id = v_uid
   ) as p;

  return v_ids;
end;
$$;

revoke execute on function public.create_tasks(jsonb, bigint[], bigint[]) from public, anon;
grant execute on function public.create_tasks(jsonb, bigint[], bigint[]) to authenticated;
