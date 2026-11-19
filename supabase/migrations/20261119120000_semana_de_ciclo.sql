-- Semana de ciclo.
--
-- Cada ciclo guarda su meta de flora (en semanas, 8 si no se elige otra) y el
-- pase a flora previsto mientras está en vegetativo. Con eso la app dice "Flora
-- · semana 4 de ~8", calcula la cosecha aproximada y deja agendar por semana
-- de etapa. Cuando alguna planta pasa a flora de verdad, manda su fecha y el
-- previsto se ignora (no hace falta borrarlo).
--
-- Compatible con la versión publicada: son columnas nuevas con valor por
-- defecto, y las políticas de `cycles` (por dueño de la fila) no cambian.
alter table public.cycles
  add column if not exists flower_target_weeks smallint not null default 8,
  add column if not exists planned_flower_start date;

alter table public.cycles
  drop constraint if exists cycles_flower_target_weeks_check;
alter table public.cycles
  add constraint cycles_flower_target_weeks_check check (flower_target_weeks between 1 and 30);
