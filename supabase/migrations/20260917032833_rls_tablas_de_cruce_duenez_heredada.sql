-- 3 · Tablas de cruce: prender RLS con la dueñez heredada del padre.
-- No tienen user_id propio. Cada enable va junto con su policy en la misma
-- transacción: prender RLS sin policies bloquearía todo.

-- task_plants -> la tarea
alter table public.task_plants enable row level security;

create policy "task_plants: dueño de la tarea"
  on public.task_plants for all to authenticated
  using (exists (
    select 1 from public.tasks t
    where t.id = task_plants.task_id and t.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.tasks t
    where t.id = task_plants.task_id and t.user_id = (select auth.uid())));

-- task_cycles -> la tarea
alter table public.task_cycles enable row level security;

create policy "task_cycles: dueño de la tarea"
  on public.task_cycles for all to authenticated
  using (exists (
    select 1 from public.tasks t
    where t.id = task_cycles.task_id and t.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.tasks t
    where t.id = task_cycles.task_id and t.user_id = (select auth.uid())));

-- combo_items -> el combo
alter table public.combo_items enable row level security;

create policy "combo_items: dueño del combo"
  on public.combo_items for all to authenticated
  using (exists (
    select 1 from public.fertilizer_combos fc
    where fc.id = combo_items.combo_id and fc.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.fertilizer_combos fc
    where fc.id = combo_items.combo_id and fc.user_id = (select auth.uid())));
