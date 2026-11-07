-- Efectos de las tareas — limpieza.
--
-- `update_task_series` quedó sin uso: "esta y las siguientes" lo hace
-- `update_task_series_rows`, que recalcula la descripción y la mezcla de cada
-- tarea de la serie. Nada la llama desde la app.
--
-- El resto del cambio no toca la base: los registros que escriben las tareas
-- llevan `data.task_id`, que es lo que ya usa `delete_task_logs` para
-- deshacerlas.
drop function if exists public.update_task_series(bigint, text, text, text, text, date);
