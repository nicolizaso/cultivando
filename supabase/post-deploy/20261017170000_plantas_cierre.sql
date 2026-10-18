-- Etapa 3 · Plantas — cierre. Aplicar DESPUÉS de publicar el código nuevo: la
-- versión vieja escribe la palabra "Nunca" en `last_water` y pide
-- `current_age_days` / `days_in_stage` en sus consultas.

-- 1 · `last_water` pasa de texto a fecha. Convivían cuatro formatos ("Hoy",
-- "Nunca", "2026-09-17" y un ISO completo); hoy los 43 valores son ISO. Un
-- instante se convierte al día de Argentina; lo que no es una fecha queda null.
alter table public.plants
  alter column last_water type date
  using (
    case
      when last_water ~ '^\d{4}-\d{2}-\d{2}T' then (last_water::timestamptz at time zone 'America/Argentina/Buenos_Aires')::date
      when last_water ~ '^\d{4}-\d{2}-\d{2}$' then last_water::date
      else null
    end
  );

-- 2 · Las columnas calculadas de la base. La app calcula etapa, días en etapa y
-- edad en un solo lugar (app/lib/plant-metrics.ts); estas daban otro número.
drop function if exists public.current_age_days(public.plants);
drop function if exists public.days_in_stage(public.plants);
