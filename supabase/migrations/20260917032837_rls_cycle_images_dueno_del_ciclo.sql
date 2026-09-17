-- 4 · cycle_images: acotar al dueño del ciclo.
-- Las cuatro operaciones estaban con `true` para `authenticated`: en un proyecto
-- compartido, "logueado" no quiere decir "usuario de esta app". Con las cuentas
-- de cliente de Vicio, cualquier comprador podría leer, editar y borrar estas filas.

drop policy if exists "Enable read access for authenticated users"   on public.cycle_images;
drop policy if exists "Enable insert access for authenticated users" on public.cycle_images;
drop policy if exists "Enable update access for authenticated users" on public.cycle_images;
drop policy if exists "Enable delete access for authenticated users" on public.cycle_images;

create policy "cycle_images: dueño del ciclo"
  on public.cycle_images for all to authenticated
  using (exists (
    select 1 from public.cycles c
    where c.id = cycle_images.cycle_id and c.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.cycles c
    where c.id = cycle_images.cycle_id and c.user_id = (select auth.uid())));
