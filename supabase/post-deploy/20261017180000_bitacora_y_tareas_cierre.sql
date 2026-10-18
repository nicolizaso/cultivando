-- Etapa 4 · Bitácora y tareas — cierre. Aplicar DESPUÉS de publicar el código
-- nuevo: la versión vieja escribe "Cambio de Ambiente" en la bitácora y las
-- columnas `date` y `cycle_id` en cada tarea nueva.

-- 1 · Lo que la versión vieja haya escrito entre la migración compatible y el
-- deploy, a la forma canónica; después, sólo valores conocidos.
update public.logs
   set type = case lower(btrim(type))
                when 'cambio de etapa' then 'cambio_etapa'
                when 'cambio de ambiente' then 'ambiente'
                when 'image' then 'foto'
                when 'imagen' then 'foto'
                else lower(btrim(type))
              end;

update public.logs set type = 'otro'
 where type not in (
   'foto', 'nota', 'cosecha',
   'riego', 'fertilizante', 'repelente', 'trasplante', 'esquejado', 'poda', 'entrenamiento',
   'ambiente', 'cambio_etapa', 'lavado', 'cosechar', 'muerta', 'otro'
 );

alter table public.logs drop constraint if exists logs_type_check;
alter table public.logs add constraint logs_type_check check (type in (
  'foto', 'nota', 'cosecha',
  'riego', 'fertilizante', 'repelente', 'trasplante', 'esquejado', 'poda', 'entrenamiento',
  'ambiente', 'cambio_etapa', 'lavado', 'cosechar', 'muerta', 'otro'
));

-- 2 · Columnas heredadas de `tasks`. Los ciclos y plantas de una tarea viven
-- en `task_cycles` / `task_plants` (y en `metadata.targets`); antes de borrar
-- las columnas viejas se copia a las tablas de cruce lo que todavía no esté.
insert into public.task_cycles (task_id, cycle_id)
select t.id, t.cycle_id
  from public.tasks t
 where t.cycle_id is not null
on conflict do nothing;

insert into public.task_cycles (task_id, cycle_id)
select t.id, c.id
  from public.tasks t
  join public.cycles c on c.space_id = t.space_id
 where t.space_id is not null
   and not exists (select 1 from public.task_cycles tc where tc.task_id = t.id)
on conflict do nothing;

insert into public.task_plants (task_id, plant_id)
select t.id, t.plant_id
  from public.tasks t
 where t.plant_id is not null
on conflict do nothing;

alter table public.tasks drop column if exists is_completed;
alter table public.tasks drop column if exists date;
alter table public.tasks drop column if exists cycle_id;
alter table public.tasks drop column if exists space_id;
alter table public.tasks drop column if exists plant_id;
alter table public.tasks drop column if exists fertilizer_combo_id;

-- 3 · Toda tarea tiene dueño (hoy ninguna está sin), y se completa solo.
alter table public.tasks alter column user_id set default auth.uid();
alter table public.tasks alter column user_id set not null;
