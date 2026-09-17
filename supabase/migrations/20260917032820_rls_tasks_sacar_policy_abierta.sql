-- 2 · tasks: sacar la policy abierta.
-- Las policies permissive se combinan con OR, así que "Public access" (ALL,
-- using true, rol public) anulaba por completo a "Usuarios gestionan sus propias
-- tareas". Al quedar sola, la buena pasa a gobernar; como su with_check es nulo,
-- PostgreSQL reusa su `using` para INSERT y UPDATE.

drop policy if exists "Public access" on public.tasks;
