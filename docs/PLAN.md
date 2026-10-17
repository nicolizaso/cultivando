# Plan de arreglos y funciones nuevas

Plan acordado después de revisar el código y la base de Supabase (proyecto
"Cultivapp"). Cada etapa es un PR chico que se prueba antes de pasar a la
siguiente. Lo del esquema `vicio` queda afuera: esa tienda no está online.

## Decisiones tomadas

- **Login por nombre de usuario:** se mantiene, pero la búsqueda usuario → email
  pasa al servidor con la clave de servicio y deja de ser pública.
- **Nutrición:** el código se adapta a las columnas reales de la base
  (`stage_category`, `dosage_type`, `fixed_dosage`, `weekly_dosages`).
- **Borrar una planta:** borra también su bitácora, como promete el aviso.
- **Huso horario:** fijo en Argentina (`America/Argentina/Buenos_Aires`).

## Migraciones en dos partes

- `supabase/migrations/`: compatibles con la versión publicada. Se aplican antes
  de probar el preview.
- `supabase/post-deploy/`: cierran lo que la versión vieja todavía usa. Se
  aplican después del merge.

Lo que te toca hacer a vos está en `docs/PENDIENTES.md`.

## Cómo se trabaja cada etapa

1. Código y migración (`supabase/migrations/`) en la rama de la sesión.
2. Tipos, lint, tests y build en verde.
3. PR para revisar.
4. Con el OK, se aplica la migración en Supabase (antes del merge si el código
   nuevo la necesita).
5. Merge y siguiente etapa.

---

## Parte 1 · Arreglos

### Etapa 0 · Base de trabajo
- [x] `next` 16.4.2, `react` 19.3.1 y `npm audit fix`: producción sin vulnerabilidades.
  Quedan 5 altas sólo en herramientas de lint (`eslint-config-next`), sin arreglo publicado.
- [x] `middleware.ts` → `proxy.ts`, como pide Next 16.
- [x] Tipos generados desde la base (`app/lib/database.types.ts`). Los clientes se
  tipan al final de la Etapa 4: hoy darían 61 errores, que son justo los desajustes
  de las etapas 2 a 4.
- [x] Scripts `test` y `typecheck`; fuera `export`, `gh-pages`, `homepage` y `dotenv`.

### Etapa 1 · Seguridad
- [x] Base: sacar a `anon` de `email_for_username` (cierre) y de `handle_new_user`.
- [x] Base: `search_path` fijo en `current_age_days` y `days_in_stage`.
- [x] Base: nombre de usuario único sin distinguir mayúsculas.
- [x] Bucket `images`: cada uno ve y borra lo suyo, sin listado público, 5 MB y sólo imágenes; subida sólo en la carpeta propia (cierre).
- [x] Borrar las 4 reglas del bucket inexistente `plant-photos`.
- [x] Script para borrar los 11 archivos huérfanos (`scripts/limpiar-fotos-huerfanas.mjs`; lo corrés vos).
- [x] Login por usuario resuelto en el servidor con la clave de servicio.
- [x] Server Actions de tareas, ciclos, espacios y bitácora: verifican sesión; `updateSpace` y `updateCycleImage` aceptan sólo sus campos.
- [x] Subidas: validación de tipo y tamaño en el servidor, carpeta por usuario, límite de las Server Actions a 4 MB; la bitácora sube por el servidor.
- [x] Errores amigables en vez de los mensajes crudos de la base (tareas, ciclos, espacios, bitácora).
- [x] Contraseña mínima de 8 caracteres y validación de email y usuario al registrarse.
- [ ] (Vos, panel de Supabase) Activar la protección contra contraseñas filtradas.

### Etapa 2 · Nutrición
- [x] Tipos y pantallas con los nombres reales de las columnas.
- [x] Base: `dosage_type` por defecto `'fija'` y valores válidos; `user_id` por defecto.
- [x] Combos: se leen desde `combo_items` y se guardan con `save_fertilizer_combo` (todo o nada).
- [x] Receta con los días en etapa reales: el modal la calcula con el objetivo
  elegido y el servidor la recalcula para cada fecha de la serie.

### Etapa 3 · Etapas y fechas de las plantas
- [x] Una sola fórmula para "días en etapa" y "edad" (`app/lib/plant-metrics.ts`), en días de Argentina.
- [x] Un solo camino para cambiar de etapa (`bulkChangeStage`, que escribe etapa, fecha y `stage_updated_at`):
  lo usan el lote, el sugeridor y las tareas; la edición deduce la etapa de la línea de tiempo.
- [x] Al crear plantas se anota la fecha de la etapa inicial; los esquejes del onboarding arrancan en Enraizamiento.
- [x] Base: completar las 7 plantas sin fechas de etapa; `mother_id` a bigint; madre borrada → esquejes sin madre.
- [x] `last_water` de texto a fecha (cierre); el código ya no escribe "Nunca" ni "Hoy".
- [x] Fuera `current_age_days` y `days_in_stage` de las consultas (y de la base, en el cierre).
- [x] Alta, edición, borrado, riego rápido y sugerencia de etapa por Server Actions.
- [x] Edición de planta: ciclo actual aunque esté cerrado y opción "Sin ciclo".
- [x] Borrar una planta borra también sus fotos del bucket.

### Etapa 4 · Bitácora, tareas y borrados
- [x] Base: tipos de registro unificados (`app/lib/logs.ts` y migración); valores válidos en el cierre.
- [x] Ficha de planta y Agenda muestran todos los registros con su tipo, no sólo las fotos.
- [x] Ficha de planta: sus tareas reales (las de su ciclo y las suyas, ver `taskAppliesToPlant`); fuera la consulta por `space_id`.
- [x] Editar desde la Agenda recibe la tarea completa y no pisa etapa ni tipo de aplicación.
- [x] Columnas viejas de `tasks` fuera (cierre), con copia previa a las tablas de cruce; `user_id` obligatorio; `status` con valores válidos.
- [x] Borrados: espacio destino de "Cambiar ambiente" (queda sin destino), planta con su bitácora,
  ciclo y espacio por Server Actions, y los archivos del bucket se borran con su ciclo o planta.
- [x] Historial de clima con las mediciones más recientes.
- [x] Clientes de Supabase tipados con `Database`: los 61 errores de tipos quedaron resueltos.
- [x] Agenda por mes y agrupada por día; ficha de ciclo con consultas en paralelo. *(Adelantado de la Etapa 6.)*

### Etapa 5 · Panel, fechas y tareas
- [x] "Hoy" en hora argentina, en un solo lugar; formularios con `todayForInput()`. Fechas mostradas con `formatInAppTz`.
- [x] Panel: sección de atrasadas y sin plantas archivadas.
- [x] Recurrencias: aviso del tope (ahora 90) y mensual sin corrimiento desde el 31. *(Adelantado en la Etapa 2.)*
- [x] Crear tareas con sus relaciones en una sola transacción (`create_tasks`). *(Adelantado en la Etapa 2.)*
- [x] Tareas sin efectos duplicados ni operaciones a medias: cambio de estado condicional, esquejado en una transacción (`complete_esquejado`) y "esta y las siguientes" en una consulta (`update_task_series`).
- [x] Confirmación en "Declarar muerta" y "Cambiar ambiente"; "Deshacer" en el aviso para todas las tareas con efecto (30 minutos).
- [x] Sugeridor de etapa: recuerda "Ahora no" una semana e ignora archivadas. *(Adelantado en la Etapa 3.)*
- [x] Onboarding sólo sin espacios; "Omitir" se recuerda (cookie `onboarding_omitido`).
- [x] Los links `/plants?search=` filtran.

### Etapa 6 · Rendimiento
- [x] Base: políticas con `(select auth.uid())` y `to authenticated`, índices en `user_id`, relaciones y `tasks(user_id, due_date)`; fuera `idx_tasks_date` e `idx_tasks_user_id` (`20261017190000_rendimiento.sql`).
- [x] Ficha de ciclo con consultas en paralelo. *(Hecho en la Etapa 4.)*
- [x] Sesión verificada una sola vez por página (`getCurrentUser` con `cache`).
- [x] Agenda por mes y agrupada por día. *(Hecho en la Etapa 4.)*
- [x] Menos consultas al crear o editar series de tareas. *(Hecho en las Etapas 2 y 5.)*

### Etapa 7 · Limpieza
- [ ] Lint sin errores; los `any` reemplazados por tipos generados. Con Next 16.4
  aparecieron más avisos de `react-hooks/set-state-in-effect` (19) y uno de
  `react-hooks/immutability`.
- [ ] Base: borrar los enums sin uso `grow_stage` y `space_type`.
- [ ] Escrituras restantes desde el navegador → Server Actions.
- [ ] Código muerto fuera (`completeTask`, campos obsoletos).
- [ ] GitHub Actions con lint, tipos, tests y build en cada PR.

---

## Parte 2 · Funciones nuevas

| Etapa | Función | Depende de |
|---|---|---|
| 8 | Clima histórico y VPD por etapa | 4 |
| 9 | Timelapse del ciclo | — |
| 10 | Linaje de madres y esquejes | 3 |
| 11 | Estadísticas por genética | 3 |
| 12 | Riego con datos (pH, EC, litros) en `logs.data` | 2 y 4 |
| 13 | Stock de fertilizantes | 2 y 12 |
| 14 | Cosecha y rendimiento (g/planta, g/m², g/W) | 3 |
| 15 | Plan de cultivo automático | 2, 5 y 11 |
| 16 | Exportar o compartir un ciclo | 8 y 14 |
| 17 | Notificaciones push | 5 y 8 |

- [ ] Etapa 8 · Clima histórico y VPD por etapa
- [ ] Etapa 9 · Timelapse del ciclo
- [ ] Etapa 10 · Linaje de madres y esquejes
- [ ] Etapa 11 · Estadísticas por genética
- [ ] Etapa 12 · Riego con datos
- [ ] Etapa 13 · Stock de fertilizantes
- [ ] Etapa 14 · Cosecha y rendimiento
- [ ] Etapa 15 · Plan de cultivo automático
- [ ] Etapa 16 · Exportar o compartir un ciclo
- [ ] Etapa 17 · Notificaciones push
