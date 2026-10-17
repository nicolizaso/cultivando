-- Etapa 4 · Bitácora, tareas y borrados — compatible con la versión publicada.

-- 1 · Tipos de la bitácora unificados en minúscula, con los ids de la
-- taxonomía. Convivían "Foto" y "foto", "Cambio de Etapa" y "cambio_etapa",
-- "Riego" y "riego": cada pantalla comparaba contra una forma distinta.
update public.logs
   set type = case lower(btrim(type))
                when 'cambio de etapa' then 'cambio_etapa'
                when 'cambio de ambiente' then 'ambiente'
                when 'image' then 'foto'
                when 'imagen' then 'foto'
                else lower(btrim(type))
              end
 where type is distinct from case lower(btrim(type))
                when 'cambio de etapa' then 'cambio_etapa'
                when 'cambio de ambiente' then 'ambiente'
                when 'image' then 'foto'
                when 'imagen' then 'foto'
                else lower(btrim(type))
              end;

-- 2 · Borrar una planta borra su bitácora (decisión tomada: es lo que promete
-- el aviso). Antes los registros quedaban sueltos, sin planta.
alter table public.logs drop constraint if exists logs_plant_id_fkey;
alter table public.logs add constraint logs_plant_id_fkey
  foreign key (plant_id) references public.plants(id) on delete cascade;

-- 3 · Borrar un espacio que es destino de una tarea "Cambiar ambiente" ya no
-- falla: la tarea queda sin destino.
alter table public.tasks drop constraint if exists tasks_target_space_id_fkey;
alter table public.tasks add constraint tasks_target_space_id_fkey
  foreign key (target_space_id) references public.spaces(id) on delete set null;

-- 4 · Estado de la tarea: sólo los dos que usa la app.
update public.tasks set status = 'pending' where status is null;
alter table public.tasks alter column status set not null;
alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check check (status in ('pending', 'completed'));
