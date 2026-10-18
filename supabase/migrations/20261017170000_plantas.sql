-- Etapa 3 · Plantas — compatible con la versión publicada.

-- 1 · Plantas sin ninguna fecha de etapa (hoy son 7): se les anota la fecha
-- de su etapa actual, tomada de `stage_updated_at` o, si no está, de cuándo se
-- plantaron. Sin esa fecha la ficha decía "0 días en etapa" para siempre.
update public.plants p
   set date_germinacion   = case when p.stage = 'Germinación'   then coalesce(p.stage_updated_at, p.planted_at, p.created_at) else p.date_germinacion end,
       date_plantula      = case when p.stage = 'Plántula'      then coalesce(p.stage_updated_at, p.planted_at, p.created_at) else p.date_plantula end,
       date_enraizamiento = case when p.stage = 'Enraizamiento' then coalesce(p.stage_updated_at, p.planted_at, p.created_at) else p.date_enraizamiento end,
       date_vegetativo    = case when p.stage = 'Vegetativo'    then coalesce(p.stage_updated_at, p.planted_at, p.created_at) else p.date_vegetativo end,
       date_floracion     = case when p.stage = 'Floración'     then coalesce(p.stage_updated_at, p.planted_at, p.created_at) else p.date_floracion end,
       date_secado        = case when p.stage = 'Secado'        then coalesce(p.stage_updated_at, p.planted_at, p.created_at) else p.date_secado end,
       date_curado        = case when p.stage = 'Curado'        then coalesce(p.stage_updated_at, p.planted_at, p.created_at) else p.date_curado end
 where coalesce(p.date_germinacion, p.date_plantula, p.date_enraizamiento, p.date_vegetativo,
                p.date_floracion, p.date_secado, p.date_curado) is null
   and p.stage in ('Germinación', 'Plántula', 'Enraizamiento', 'Vegetativo', 'Floración', 'Secado', 'Curado');

-- 2 · `mother_id` era int y `id` es bigint. Además, borrar una madre fallaba con
-- un error de clave foránea: ahora sus esquejes quedan sin madre y siguen ahí.
alter table public.plants drop constraint if exists plants_mother_id_fkey;
alter table public.plants alter column mother_id type bigint;
alter table public.plants add constraint plants_mother_id_fkey
  foreign key (mother_id) references public.plants(id) on delete set null;
create index if not exists plants_mother_id_idx on public.plants (mother_id);
