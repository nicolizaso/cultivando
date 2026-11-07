-- Mezclas de nutrientes — compatible con la versión publicada: columnas nuevas
-- con valor por defecto y funciones nuevas. Las funciones viejas
-- (`save_fertilizer_combo`, `update_task_series`) quedan para la versión
-- publicada hasta que salga esta.

-- 1 · Unidad y base de la dosis de cada producto. Hasta ahora todo era "ml por
-- litro de agua"; las enmiendas sólidas se dosifican en gramos y muchas veces
-- por planta. El stock (`stock_ml`, `container_ml`, `low_stock_ml`) se lleva
-- en la unidad del producto: ml o g.
alter table public.fertilizers add column if not exists unit text not null default 'ml';
alter table public.fertilizers add column if not exists dose_basis text not null default 'litro';

alter table public.fertilizers drop constraint if exists fertilizers_unit_check;
alter table public.fertilizers add constraint fertilizers_unit_check check (unit in ('ml', 'g'));

alter table public.fertilizers drop constraint if exists fertilizers_dose_basis_check;
alter table public.fertilizers add constraint fertilizers_dose_basis_check check (dose_basis in ('litro', 'planta'));

-- 2 · Dosis propia de un producto dentro de un combo. Null = la del producto
-- (fija o la de su semana).
alter table public.combo_items add column if not exists dose numeric;

alter table public.combo_items drop constraint if exists combo_items_dose_check;
alter table public.combo_items add constraint combo_items_dose_check check (dose is null or (dose >= 0 and dose <= 1000));

-- 3 · Guardar un combo con sus productos y la dosis de cada uno, todo junto.
-- p_items: [{ fertilizer_id, dose }] (dose null = la del producto).
create or replace function public.save_fertilizer_combo_items(
  p_combo_id bigint,
  p_name text,
  p_description text,
  p_items jsonb
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ids bigint[];
  v_owned integer;
  v_combo_id bigint;
begin
  if v_uid is null then
    raise exception 'Hace falta iniciar sesión' using errcode = '42501';
  end if;

  if coalesce(btrim(p_name), '') = '' then
    raise exception 'El combo necesita un nombre' using errcode = '23514';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'El combo necesita al menos un producto' using errcode = '23514';
  end if;

  select coalesce(array_agg(distinct x.fertilizer_id), '{}') into v_ids
    from jsonb_to_recordset(p_items) as x(fertilizer_id bigint, dose numeric)
   where x.fertilizer_id is not null;

  if cardinality(v_ids) = 0 then
    raise exception 'El combo necesita al menos un producto' using errcode = '23514';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_items) as x(fertilizer_id bigint, dose numeric)
     where x.dose is not null and (x.dose < 0 or x.dose > 1000)
  ) then
    raise exception 'Alguna dosis no es válida' using errcode = '23514';
  end if;

  select count(*) into v_owned
    from public.fertilizers f
   where f.id = any (v_ids) and f.user_id = v_uid;

  if v_owned <> cardinality(v_ids) then
    raise exception 'Alguno de los productos no existe' using errcode = '23503';
  end if;

  if p_combo_id is null then
    insert into public.fertilizer_combos (name, description, user_id)
    values (btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), v_uid)
    returning id into v_combo_id;
  else
    update public.fertilizer_combos
       set name = btrim(p_name),
           description = nullif(btrim(coalesce(p_description, '')), '')
     where id = p_combo_id and user_id = v_uid
    returning id into v_combo_id;

    if v_combo_id is null then
      raise exception 'No se encontró el combo' using errcode = 'P0002';
    end if;

    delete from public.combo_items where combo_id = v_combo_id;
  end if;

  insert into public.combo_items (combo_id, fertilizer_id, dose)
  select distinct on (x.fertilizer_id) v_combo_id, x.fertilizer_id, x.dose
    from jsonb_to_recordset(p_items) as x(fertilizer_id bigint, dose numeric)
   where x.fertilizer_id is not null
   order by x.fertilizer_id;

  return v_combo_id;
end;
$$;

revoke execute on function public.save_fertilizer_combo_items(bigint, text, text, jsonb) from public, anon;
grant execute on function public.save_fertilizer_combo_items(bigint, text, text, jsonb) to authenticated;

-- 4 · Editar "esta y las siguientes" de una serie con lo de cada tarea. La
-- versión anterior copiaba la descripción de la tarea editada a todas, y con
-- ella la receta de esa semana: todas quedaban con la misma dosis. Ahora el
-- servidor calcula fecha, descripción y mezcla de cada una y las escribe
-- juntas, en una sola consulta.
--
-- p_rows: [{ id, due_date, description, nutrition? }]. Si la fila trae la
-- clave `nutrition`, reemplaza `metadata.nutrition` (null la saca); si no, la
-- metadata queda como estaba. Sólo toca tareas de la misma serie, del mismo
-- usuario y desde la elegida en adelante.
create or replace function public.update_task_series_rows(
  p_task_id bigint,
  p_title text,
  p_application_type text,
  p_target_stage text,
  p_rows jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_task record;
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

  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'No hay tareas para actualizar' using errcode = '22023';
  end if;

  update public.tasks t
     set title = coalesce(nullif(btrim(p_title), ''), t.title),
         application_type = p_application_type,
         target_stage = p_target_stage,
         due_date = coalesce(nullif(r.value->>'due_date', '')::timestamptz, t.due_date),
         description = nullif(r.value->>'description', ''),
         metadata = case
           when r.value ? 'nutrition' then
             (coalesce(t.metadata, '{}'::jsonb) - 'nutrition')
             || case when jsonb_typeof(r.value->'nutrition') = 'object'
                     then jsonb_build_object('nutrition', r.value->'nutrition')
                     else '{}'::jsonb end
           else t.metadata
         end
    from jsonb_array_elements(p_rows) as r(value)
   where t.id = (r.value->>'id')::bigint
     and t.user_id = v_uid
     and t.recurrence_id = v_task.recurrence_id
     and t.due_date >= v_task.due_date;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.update_task_series_rows(bigint, text, text, text, jsonb) from public, anon;
grant execute on function public.update_task_series_rows(bigint, text, text, text, jsonb) to authenticated;

-- 5 · Deshacer lo que anotó una tarea en la bitácora. La bitácora no se borra
-- desde la app (no hay política de borrado), salvo esto: los registros que
-- creó al completarse una tarea del propio usuario, marcados con su id en
-- `data.task_id`, dentro de "Deshacer".
create or replace function public.delete_task_logs(
  p_task_id bigint,
  p_log_ids bigint[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Hace falta iniciar sesión' using errcode = '42501';
  end if;

  if not exists (select 1 from public.tasks where id = p_task_id and user_id = v_uid) then
    raise exception 'No se encontró la tarea' using errcode = 'P0002';
  end if;

  delete from public.logs l
   where l.id = any (coalesce(p_log_ids, '{}'))
     and l.user_id = v_uid
     and l.data->>'task_id' = p_task_id::text;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.delete_task_logs(bigint, bigint[]) from public, anon;
grant execute on function public.delete_task_logs(bigint, bigint[]) to authenticated;
