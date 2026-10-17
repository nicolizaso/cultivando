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
- [ ] Base: sacar a `anon` de `email_for_username` y `handle_new_user`.
- [ ] Base: `search_path` fijo en `current_age_days` y `days_in_stage`.
- [ ] Bucket `images`: borrado del propio dueño, sin listado público, 5 MB y sólo imágenes.
- [ ] Borrar las 4 reglas del bucket inexistente `plant-photos`.
- [ ] Borrar los 11 archivos huérfanos (6,3 MB), con confirmación.
- [ ] Login por usuario resuelto en el servidor.
- [ ] Server Actions: verifican sesión y aceptan sólo campos permitidos.
- [ ] Subidas: validación de tipo y tamaño, carpeta por usuario, límite de las Server Actions.
- [ ] Errores amigables en vez de los mensajes crudos de la base.
- [ ] Contraseña mínima de 8 caracteres.
- [ ] (Panel de Supabase) Activar la protección contra contraseñas filtradas.

### Etapa 2 · Nutrición
- [ ] Tipos y pantallas con los nombres reales de las columnas.
- [ ] Base: `dosage_type` por defecto `'fija'` y valores válidos.
- [ ] Combos: leer y reescribir `combo_items`; crear un combo es todo o nada.
- [ ] Receta con los días en etapa reales de cada planta o ciclo.

### Etapa 3 · Etapas y fechas de las plantas
- [ ] Una sola acción para cambiar de etapa (`stage`, fecha de la etapa y `stage_updated_at`).
- [ ] Al crear plantas se anota la fecha de la etapa inicial; esquejes en Enraizamiento.
- [ ] Una sola fórmula para "días en etapa" y "edad".
- [ ] Base: completar las 7 plantas sin fechas de etapa; `mother_id` a bigint; madre borrada → esquejes sin madre.
- [ ] `last_water` de texto a fecha; no más "Nunca" ni "Hoy".
- [ ] Escrituras de plantas desde el navegador → Server Actions.
- [ ] Edición de planta: ciclo actual aunque esté cerrado y opción "Sin ciclo".

### Etapa 4 · Bitácora, tareas y borrados
- [ ] Base: unificar los tipos de registro y limitar los valores válidos.
- [ ] Ficha y Agenda muestran todos los registros, no sólo las fotos.
- [ ] Ficha de planta: tareas de su ciclo; fuera la consulta por `space_id`.
- [ ] Editar desde la Agenda no pisa etapa ni tipo de aplicación.
- [ ] Columnas viejas de `tasks`: migrar `cycle_id` y `space_id`, borrar `is_completed`, `plant_id` y `date`; `user_id` obligatorio.
- [ ] Borrados: espacio destino de "Cambiar ambiente", planta con su bitácora, archivos de ciclos y fotos.
- [ ] Historial de clima con las mediciones más recientes.
- [ ] Clientes de Supabase tipados con `Database` (`createBrowserClient<Database>` y `createServerClient<Database>`).

### Etapa 5 · Panel, fechas y tareas
- [ ] "Hoy" en hora argentina, en un solo lugar; formularios con `todayForInput()`.
- [ ] Panel: sección de atrasadas y sin plantas archivadas.
- [ ] Recurrencias: aviso del tope y mensual sin corrimiento desde el 31.
- [ ] Tareas sin efectos duplicados ni operaciones a medias.
- [ ] Confirmación y "Deshacer" en "Declarar muerta" y "Cambiar ambiente".
- [ ] Sugeridor de etapa: recuerda "Ahora no" e ignora archivadas.
- [ ] Onboarding sólo sin espacios; "Omitir" se recuerda.
- [ ] Los links `/plants?search=` filtran.

### Etapa 6 · Rendimiento
- [ ] Base: políticas con `(select auth.uid())`, índices en `user_id`, relaciones y `tasks.due_date`; fuera `idx_tasks_date`.
- [ ] Ficha de ciclo con consultas en paralelo.
- [ ] Sesión verificada una sola vez por página.
- [ ] Agenda por mes y agrupada por día.
- [ ] Menos consultas al crear o editar series de tareas.

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
