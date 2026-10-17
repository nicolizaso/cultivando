-- Etapa 2 · Nutrición — compatible con la versión publicada.

-- 1 · Valores válidos y por defecto. El default era 'fixed', que la app nunca
-- escribió ni entiende: la app usa 'fija' y 'semanal'. Hoy los tres productos
-- cargados ya cumplen, así que las restricciones entran sin tocar datos.
update public.fertilizers set dosage_type = 'fija' where dosage_type = 'fixed';
alter table public.fertilizers alter column dosage_type set default 'fija';

alter table public.fertilizers drop constraint if exists fertilizers_dosage_type_check;
alter table public.fertilizers add constraint fertilizers_dosage_type_check
  check (dosage_type in ('fija', 'semanal'));

alter table public.fertilizers drop constraint if exists fertilizers_stage_category_check;
alter table public.fertilizers add constraint fertilizers_stage_category_check
  check (stage_category is null or stage_category in ('enraizamiento', 'vegetativo', 'floracion', 'lavado', 'todo'));

-- 2 · El dueño se completa solo, como en el resto de las tablas.
alter table public.fertilizers alter column user_id set default auth.uid();
alter table public.fertilizer_combos alter column user_id set default auth.uid();

-- 3 · Guardar un combo con sus productos en una sola transacción.
-- Crea (p_combo_id null) o reescribe un combo. Corre con los permisos de
-- quien la llama, así que la RLS sigue mandando; además verifica que todos
-- los productos sean del usuario, cosa que la política de combo_items no mira.
create or replace function public.save_fertilizer_combo(
  p_combo_id bigint,
  p_name text,
  p_description text,
  p_fertilizer_ids bigint[]
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

  select coalesce(array_agg(distinct id), '{}') into v_ids
    from unnest(coalesce(p_fertilizer_ids, '{}')) as id;

  if cardinality(v_ids) = 0 then
    raise exception 'El combo necesita al menos un producto' using errcode = '23514';
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

  insert into public.combo_items (combo_id, fertilizer_id)
  select v_combo_id, id from unnest(v_ids) as id;

  return v_combo_id;
end;
$$;

revoke execute on function public.save_fertilizer_combo(bigint, text, text, bigint[]) from public, anon;
grant execute on function public.save_fertilizer_combo(bigint, text, text, bigint[]) to authenticated;
