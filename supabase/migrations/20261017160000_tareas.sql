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

-- 2 · Completar un esquejado: crea los esquejes y cierra la tarea en una sola
-- transacción, con la fila de la tarea bloqueada. Antes se creaban las plantas
-- y después se marcaba la tarea: un doble envío, o una falla entre los dos
-- pasos, duplicaba los esquejes.
--
-- p_seeds:    [{ name, strain, breeder, mother_id, planted_at }] ya numerados.
-- p_summary:  { date, target_cycle_id, entries: [{ mother_id, mother_name, count }] }
-- p_new_cycle: { name, space_id, start_date } para abrir un ciclo nuevo, o null.
create or replace function public.complete_esquejado(
  p_task_id bigint,
  p_seeds jsonb,
  p_summary jsonb,
  p_new_cycle jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_task record;
  v_cycle_id bigint;
  v_seed_count integer := coalesce(jsonb_array_length(p_seeds), 0);
  v_entries jsonb;
  v_total integer;
begin
  if v_uid is null then
    raise exception 'Hace falta iniciar sesión' using errcode = '42501';
  end if;

  select id, type, status, metadata into v_task
    from public.tasks
   where id = p_task_id and user_id = v_uid
     for update;

  if not found then
    raise exception 'No se encontró la tarea' using errcode = 'P0002';
  end if;

  if v_task.type is distinct from 'esquejado' then
    raise exception 'La tarea no es de esquejado' using errcode = '22023';
  end if;

  -- Ya registrada (se desmarcó y se vuelve a completar): sólo se cierra.
  if v_task.metadata ? 'esquejado' then
    update public.tasks
       set status = 'completed', completed_at = coalesce(completed_at, now())
     where id = p_task_id;
    return jsonb_build_object('created', 0, 'already', v_task.metadata->'esquejado');
  end if;

  v_cycle_id := nullif(p_summary->>'target_cycle_id', '')::bigint;

  if p_new_cycle is not null and coalesce(btrim(p_new_cycle->>'name'), '') <> '' then
    if nullif(p_new_cycle->>'space_id', '') is not null and not exists (
      select 1 from public.spaces sp
       where sp.id = (p_new_cycle->>'space_id')::bigint and sp.user_id = v_uid
    ) then
      raise exception 'No se encontró el espacio del ciclo nuevo' using errcode = 'P0002';
    end if;

    insert into public.cycles (name, start_date, space_id, is_active, user_id)
    values (
      btrim(p_new_cycle->>'name'),
      coalesce(nullif(p_new_cycle->>'start_date', '')::date, current_date),
      nullif(p_new_cycle->>'space_id', '')::bigint,
      true,
      v_uid
    )
    returning id into v_cycle_id;
  elsif v_cycle_id is not null and not exists (
    select 1 from public.cycles c where c.id = v_cycle_id and c.user_id = v_uid
  ) then
    raise exception 'No se encontró el ciclo de destino' using errcode = 'P0002';
  end if;

  if v_seed_count > 0 and v_cycle_id is null then
    raise exception 'Elegí a qué ciclo van los esquejes' using errcode = '23514';
  end if;

  if exists (
    select 1
      from jsonb_to_recordset(coalesce(p_seeds, '[]')) as s(mother_id bigint)
     where not exists (select 1 from public.plants m where m.id = s.mother_id and m.user_id = v_uid)
  ) then
    raise exception 'Alguna planta madre no existe' using errcode = '23503';
  end if;

  with inserted as (
    insert into public.plants (
      name, strain, breeder, source_type, mother_id, cycle_id, stage,
      planted_at, date_enraizamiento, stage_updated_at, last_water, user_id
    )
    select s.name, s.strain, s.breeder, 'Esqueje', s.mother_id, v_cycle_id, 'Enraizamiento',
           s.planted_at, s.planted_at, s.planted_at, null, v_uid
      from jsonb_to_recordset(coalesce(p_seeds, '[]'))
           as s(name text, strain text, breeder text, mother_id bigint, planted_at timestamptz)
    returning id, mother_id
  ),
  by_mother as (
    select mother_id, jsonb_agg(id order by id) as ids, count(*)::integer as n
      from inserted
     group by mother_id
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'mother_id', e.mother_id,
      'mother_name', e.mother_name,
      'count', coalesce(b.n, 0),
      'plant_ids', coalesce(b.ids, '[]'::jsonb)
    )), '[]'::jsonb),
    coalesce(sum(b.n), 0)::integer
    into v_entries, v_total
    from jsonb_to_recordset(coalesce(p_summary->'entries', '[]')) as e(mother_id bigint, mother_name text)
    left join by_mother b on b.mother_id = e.mother_id;

  update public.tasks
     set status = 'completed',
         completed_at = now(),
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('esquejado', jsonb_build_object(
           'date', p_summary->>'date',
           'target_cycle_id', v_cycle_id,
           'total', v_total,
           'registered_at', now(),
           'entries', v_entries
         ))
   where id = p_task_id;

  return jsonb_build_object('created', v_total, 'cycle_id', v_cycle_id, 'entries', v_entries);
end;
$$;

revoke execute on function public.complete_esquejado(bigint, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.complete_esquejado(bigint, jsonb, jsonb, jsonb) to authenticated;

-- 3 · Editar "esta y las siguientes" de una serie con una sola consulta (antes,
-- una por tarea, y los errores se ignoraban). Corre todas las fechas los
-- mismos días que se movió la elegida, contados en días de Argentina.
create or replace function public.update_task_series(
  p_task_id bigint,
  p_title text,
  p_description text,
  p_application_type text,
  p_target_stage text,
  p_new_day date
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_task record;
  v_shift integer;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Hace falta iniciar sesión' using errcode = '42501';
  end if;

  select id, due_date, recurrence_id into v_task
    from public.tasks
   where id = p_task_id and user_id = v_uid;

  if not found then
    raise exception 'No se encontró la tarea' using errcode = 'P0002';
  end if;

  if v_task.recurrence_id is null then
    raise exception 'La tarea no es parte de una serie' using errcode = '22023';
  end if;

  v_shift := p_new_day - (v_task.due_date at time zone 'America/Argentina/Buenos_Aires')::date;

  update public.tasks
     set title = coalesce(nullif(btrim(p_title), ''), title),
         description = p_description,
         application_type = p_application_type,
         target_stage = p_target_stage,
         due_date = due_date + make_interval(days => v_shift)
   where recurrence_id = v_task.recurrence_id
     and user_id = v_uid
     and due_date >= v_task.due_date;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.update_task_series(bigint, text, text, text, text, date) from public, anon;
grant execute on function public.update_task_series(bigint, text, text, text, text, date) to authenticated;
