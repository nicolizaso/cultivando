-- Rendimiento — compatible con la versión publicada: los permisos son los
-- mismos, sólo cambia cómo se evalúan, y se agregan índices.

-- 1 · Políticas con `(select auth.uid())` y sólo para usuarios con sesión.
--
-- Escrito como `auth.uid() = user_id`, Postgres llama a auth.uid() una vez por
-- fila; entre paréntesis con select lo calcula una sola vez por consulta (el
-- asesor de Supabase lo marcaba en 26 políticas). `to authenticated` evita
-- evaluarlas para anon, que de todos modos no veía nada. Las de UPDATE ahora
-- dicen explícitamente que la fila no puede pasar a otro dueño.

-- spaces
drop policy if exists "Ver mis espacios" on public.spaces;
drop policy if exists "Crear mis espacios" on public.spaces;
drop policy if exists "Modificar mis espacios" on public.spaces;
drop policy if exists "Borrar mis espacios" on public.spaces;
drop policy if exists "spaces: ver los propios" on public.spaces;
drop policy if exists "spaces: crear los propios" on public.spaces;
drop policy if exists "spaces: modificar los propios" on public.spaces;
drop policy if exists "spaces: borrar los propios" on public.spaces;
create policy "spaces: ver los propios" on public.spaces
  for select to authenticated using (user_id = (select auth.uid()));
create policy "spaces: crear los propios" on public.spaces
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "spaces: modificar los propios" on public.spaces
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "spaces: borrar los propios" on public.spaces
  for delete to authenticated using (user_id = (select auth.uid()));

-- cycles
drop policy if exists "Ver mis ciclos" on public.cycles;
drop policy if exists "Crear mis ciclos" on public.cycles;
drop policy if exists "Modificar mis ciclos" on public.cycles;
drop policy if exists "Borrar mis ciclos" on public.cycles;
drop policy if exists "cycles: ver los propios" on public.cycles;
drop policy if exists "cycles: crear los propios" on public.cycles;
drop policy if exists "cycles: modificar los propios" on public.cycles;
drop policy if exists "cycles: borrar los propios" on public.cycles;
create policy "cycles: ver los propios" on public.cycles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "cycles: crear los propios" on public.cycles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "cycles: modificar los propios" on public.cycles
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "cycles: borrar los propios" on public.cycles
  for delete to authenticated using (user_id = (select auth.uid()));

-- plants
drop policy if exists "Ver mis plantas" on public.plants;
drop policy if exists "Crear mis plantas" on public.plants;
drop policy if exists "Modificar mis plantas" on public.plants;
drop policy if exists "Borrar mis plantas" on public.plants;
drop policy if exists "plants: ver las propias" on public.plants;
drop policy if exists "plants: crear las propias" on public.plants;
drop policy if exists "plants: modificar las propias" on public.plants;
drop policy if exists "plants: borrar las propias" on public.plants;
create policy "plants: ver las propias" on public.plants
  for select to authenticated using (user_id = (select auth.uid()));
create policy "plants: crear las propias" on public.plants
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "plants: modificar las propias" on public.plants
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "plants: borrar las propias" on public.plants
  for delete to authenticated using (user_id = (select auth.uid()));

-- logs (la bitácora sólo se lee y se agrega; se borra junto con su planta o ciclo)
drop policy if exists "Ver mis logs" on public.logs;
drop policy if exists "Crear mis logs" on public.logs;
drop policy if exists "logs: ver los propios" on public.logs;
drop policy if exists "logs: crear los propios" on public.logs;
create policy "logs: ver los propios" on public.logs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "logs: crear los propios" on public.logs
  for insert to authenticated with check (user_id = (select auth.uid()));

-- measurements
drop policy if exists "Ver mis mediciones" on public.measurements;
drop policy if exists "Crear mis mediciones" on public.measurements;
drop policy if exists "Borrar mis mediciones" on public.measurements;
drop policy if exists "measurements: ver las propias" on public.measurements;
drop policy if exists "measurements: crear las propias" on public.measurements;
drop policy if exists "measurements: borrar las propias" on public.measurements;
create policy "measurements: ver las propias" on public.measurements
  for select to authenticated using (user_id = (select auth.uid()));
create policy "measurements: crear las propias" on public.measurements
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "measurements: borrar las propias" on public.measurements
  for delete to authenticated using (user_id = (select auth.uid()));

-- tasks
drop policy if exists "Usuarios gestionan sus propias tareas" on public.tasks;
drop policy if exists "tasks: las propias" on public.tasks;
create policy "tasks: las propias" on public.tasks
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- fertilizers
drop policy if exists "Users can view their own fertilizers" on public.fertilizers;
drop policy if exists "Users can create their own fertilizers" on public.fertilizers;
drop policy if exists "Users can update their own fertilizers" on public.fertilizers;
drop policy if exists "Users can delete their own fertilizers" on public.fertilizers;
drop policy if exists "fertilizers: ver los propios" on public.fertilizers;
drop policy if exists "fertilizers: crear los propios" on public.fertilizers;
drop policy if exists "fertilizers: modificar los propios" on public.fertilizers;
drop policy if exists "fertilizers: borrar los propios" on public.fertilizers;
create policy "fertilizers: ver los propios" on public.fertilizers
  for select to authenticated using (user_id = (select auth.uid()));
create policy "fertilizers: crear los propios" on public.fertilizers
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "fertilizers: modificar los propios" on public.fertilizers
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "fertilizers: borrar los propios" on public.fertilizers
  for delete to authenticated using (user_id = (select auth.uid()));

-- fertilizer_combos
drop policy if exists "Users can view their own fertilizer combos" on public.fertilizer_combos;
drop policy if exists "Users can create their own fertilizer combos" on public.fertilizer_combos;
drop policy if exists "Users can update their own fertilizer combos" on public.fertilizer_combos;
drop policy if exists "Users can delete their own fertilizer combos" on public.fertilizer_combos;
drop policy if exists "fertilizer_combos: ver los propios" on public.fertilizer_combos;
drop policy if exists "fertilizer_combos: crear los propios" on public.fertilizer_combos;
drop policy if exists "fertilizer_combos: modificar los propios" on public.fertilizer_combos;
drop policy if exists "fertilizer_combos: borrar los propios" on public.fertilizer_combos;
create policy "fertilizer_combos: ver los propios" on public.fertilizer_combos
  for select to authenticated using (user_id = (select auth.uid()));
create policy "fertilizer_combos: crear los propios" on public.fertilizer_combos
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "fertilizer_combos: modificar los propios" on public.fertilizer_combos
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "fertilizer_combos: borrar los propios" on public.fertilizer_combos
  for delete to authenticated using (user_id = (select auth.uid()));

-- 2 · Índices.
--
-- Cada política filtra por user_id y cada pantalla pide hijos de un padre
-- (plantas de un ciclo, bitácora de una planta…): sin índice, cada una de esas
-- consultas recorre la tabla entera. También los necesitan las claves
-- foráneas, para que borrar un ciclo o un producto no recorra sus hijos.
-- Las tablas son chicas, así que crearlos tarda un instante.

create index if not exists spaces_user_id_idx on public.spaces (user_id);

create index if not exists cycles_user_id_idx on public.cycles (user_id);
create index if not exists cycles_space_id_idx on public.cycles (space_id);

create index if not exists plants_user_id_idx on public.plants (user_id);
create index if not exists plants_cycle_id_idx on public.plants (cycle_id);

-- La bitácora se lee siempre de la más nueva a la más vieja.
create index if not exists logs_user_created_idx on public.logs (user_id, created_at);
create index if not exists logs_plant_created_idx on public.logs (plant_id, created_at desc);
create index if not exists logs_cycle_created_idx on public.logs (cycle_id, created_at desc);

create index if not exists measurements_user_id_idx on public.measurements (user_id);
create index if not exists measurements_cycle_date_idx on public.measurements (cycle_id, date desc, created_at desc);

create index if not exists cycle_images_cycle_taken_idx on public.cycle_images (cycle_id, taken_at desc);

create index if not exists task_cycles_cycle_id_idx on public.task_cycles (cycle_id);
create index if not exists combo_items_fertilizer_id_idx on public.combo_items (fertilizer_id);

create index if not exists fertilizers_user_id_idx on public.fertilizers (user_id);
create index if not exists fertilizer_combos_user_id_idx on public.fertilizer_combos (user_id);

-- Agenda y panel: tareas de un usuario por fecha, y las pendientes aparte
-- (las atrasadas del panel).
create index if not exists tasks_user_due_idx on public.tasks (user_id, due_date);
create index if not exists tasks_user_pending_due_idx on public.tasks (user_id, due_date) where status = 'pending';
create index if not exists tasks_target_space_id_idx on public.tasks (target_space_id);

-- `tasks_user_due_idx` empieza por user_id: el índice suelto queda de más.
-- `idx_tasks_date` es de la columna vieja `date`, que nadie consulta (el
-- asesor lo marca sin uso) y se borra en el cierre.
drop index if exists public.idx_tasks_user_id;
drop index if exists public.idx_tasks_date;
