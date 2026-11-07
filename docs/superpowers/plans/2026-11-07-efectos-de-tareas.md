# Efectos de las tareas — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada tipo de tarea haga lo que dice al completarse, deje registro en la bitácora, se deshaga al desmarcarla y no se pueda editar en contradicción con lo que ya hizo.

**Architecture:** Las decisiones (qué hace cada tipo, fecha del efecto, plan de mudanza, textos) viven en módulos puros de `app/lib` con tests de Node. Las escrituras a la base (etapa, riego, archivado, cambio de ciclo, mudanza, bitácora) se comparten entre las acciones manuales y las tareas en `app/lib/plant-writes.ts`. `app/actions/tasks.ts` orquesta: `completeTask`, `reopenTask`, `getCompletionContext`.

**Tech Stack:** Next.js 16 (Server Actions), React 19, TypeScript, Supabase, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-07-efectos-de-tareas-design.md`

## Global Constraints

- Textos en castellano rioplatense, sin tecnicismos; el color nunca comunica solo.
- Todo registro que escribe una tarea lleva `data.task_id` y `created_at` = día en que se hizo.
- Fechas de día: "YYYY-MM-DD" en hora argentina (`dateKey`, `todayKey`); un día pasado se ancla a `T12:00:00-03:00`.
- Los módulos de `app/lib` que se testean importan con extensión `.ts` y no importan JSX (`constants.tsx` no).
- Ningún cambio de base es requisito del código (sólo la migración que borra `update_task_series`).
- `npm run lint`, `npm run typecheck`, `npm test` y `npm run build` limpios.

## Review Focus

- Tarea atrasada completada sin día (llamada sin hoja): el efecto queda hoy, nunca en el día agendado ni en el futuro.
- Desmarcar después de cambiar algo a mano: lo cambiado a mano no se toca (test de `readLastEffect` con `set` y revert condicional en el servidor).
- Tareas viejas sin `metadata.targets` ni `last_effect`: se completan con los objetivos deducidos y desmarcar sólo las vuelve a pendiente.
- Doble toque al completar o desmarcar: el cambio de estado sigue siendo condicional; una sola llamada aplica o revierte.
- "Cambiar ambiente" de la única planta activa de un ciclo (caso real de la planta 56): se muda el ciclo (test en Task 1).

---

### Task 1: Reglas por tipo (puro)

**Files:**
- Modify: `app/lib/task-effects.ts`
- Test: `app/lib/task-effects.test.ts`

**Interfaces:**
- Produces:
  - `interface CompletionPlan { logType: string; water: boolean; stage: StageEffect | null; archive: boolean; harvest: boolean; move: boolean; feed: boolean }`
  - `getCompletionPlan(task: { type?: string | null; application_type?: string | null; target_stage?: string | null }): CompletionPlan | null` — null para `esquejado`.
  - `logTitleFor(type: string, taskTitle: string, stage?: string | null): string`
  - `stageLogTitle(stage: string): string` → `"Cambio de etapa a ${stage}"`
  - `cycleMoveTitle(from: string, to: string): string` → `"Mudanza de espacio: ${from} → ${to}"`
  - `getTaskEffectDate(doneOn: string | null | undefined, now?: Date): string` (ISO)
  - `isOverdue(dueDate: string | null | undefined, now?: Date): boolean`
  - `completionNeeds(task: { type: string; due_date: string; target_space_id?: number | null }, hasMix: boolean, now?: Date): { date: boolean; feed: boolean; harvest: boolean; ambiente: boolean; confirm: 'muerta' | 'ambiente' | null; any: boolean }`
  - `planAmbienteMove(targets, targetSpaceId, plants, cycleSpaces, activeCyclesInTarget, activePlantsByCycle: Map<number, number[]>, chosenCycleId?: number | null): AmbienteMovePlan` (misma forma de retorno).
  - Se borra `getTaskCompletionEffect` y el `getTaskEffectDate(dueDate)` viejo.

- [ ] **Step 1: Tests que fallan**

`getCompletionPlan`: riego → `{ logType: 'riego', water: true }`; lavado → `{ logType: 'lavado', water: true }`; fertilizante Riego → water y feed; Foliar → feed sin water; cambio_etapa Floración → stage `{ stage: 'Floración', onlyForward: false }`; cambio_etapa con etapa inválida → `stage: null`; cosechar → stage Secado onlyForward + harvest; muerta → archive; ambiente → move; poda/trasplante/entrenamiento/repelente/otro → su tipo sin efectos; tipo desconocido → logType `'otro'`; esquejado → null.
`logTitleFor`: `('riego','Riego')` → "Riego"; `('cosechar','Cosechar')` → "Cosecha"; `('muerta',…)` → "Declarada muerta"; `('cambio_etapa', …, 'Secado')` → "Cambio de etapa a Secado"; `('otro','Revisar tricomas')` → "Revisar tricomas".
`getTaskEffectDate`: sin día → `now`; hoy → `now`; `'2026-11-01'` con now 2026-11-07 → `'2026-11-01T15:00:00.000Z'`; día futuro → `now`.
`isOverdue`: due ayer → true; due hoy (cualquier hora) → false.
`completionNeeds`: riego de hoy → `any: false`; riego de ayer → `date: true`; fertilizante con mezcla → feed; cosechar → harvest; ambiente → ambiente + confirm 'ambiente'; muerta → confirm 'muerta'.
`planAmbienteMove`: planta 56 única activa de su ciclo 13 (espacio 8) → destino 9 sin ciclos activos ⇒ `cycleIds: [13]`, `unplacedPlantIds: []`; dos activas y sólo una elegida ⇒ unplaced; `chosenCycleId` activo en destino ⇒ la planta va ahí; `chosenCycleId` que no está en el destino se ignora; una planta archivada en el ciclo no impide la regla de "todas las activas". Ajustar los tests existentes a la firma nueva.

- [ ] **Step 2:** `npm test` → fallan los nuevos.
- [ ] **Step 3:** Implementar. Títulos: riego "Riego", lavado "Lavado de raíces", fertilizante "Fertilizante", cosechar "Cosecha", muerta "Declarada muerta", el resto el título de la tarea.
- [ ] **Step 4:** `npm test` → pasan.
- [ ] **Step 5:** Commit `feat(tareas): reglas por tipo, día del efecto y mudanza por ciclo entero`.

### Task 2: Qué escribió la tarea (puro)

**Files:**
- Modify: `app/lib/task-undo.ts`, `app/lib/task-undo.test.ts`

**Interfaces:**
- Produces: `LastEffect` con, además de lo actual: `waterSet?: string`, `stage.set?: { stage: string; at: string }`, `cycles[].to?: number`, `plants[].to?: number | null`, `createdCycle?: number`, `harvests?: number[]`. `readLastEffect`, `hasUndoableChanges`, `groupByValue` siguen. Se borran `UNDO_WINDOW_MS` y `canStillUndo`.

- [ ] **Step 1: Tests:** `readLastEffect` lee los campos nuevos; descarta `harvests` que no son ids; un `last_effect` viejo (sin `set`/`to`) se lee igual; `hasUndoableChanges({ at, harvests: [3] })` → true; `({ at, createdCycle: 9 })` → true. Borrar los tests de `canStillUndo`.
- [ ] **Step 2:** `npm test` → fallan.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test` → pasan.
- [ ] **Step 5:** Commit `feat(tareas): last_effect guarda lo que escribió cada tarea`.

### Task 3: Textos de los avisos (puro)

**Files:**
- Create: `app/lib/task-outcome.ts`, `app/lib/task-outcome.test.ts`

**Interfaces:**
- Produces:
  - `interface CompletionOutcome { plants: number; water: number; stage?: { stage: string; changed: number }; archived: number; harvests: number; logs: number; feed?: { plants: number; lowStock: { name: string; stock_ml: number | null }[] }; move?: { spaceName: string; cycles: number; plants: number; unplaced: number }; problems: string[] }`
  - `describeCompletion(type: string, outcome: CompletionOutcome): { message: string; tone: 'success' | 'error' }`
  - `describeReopen(result: { kept: number; failures: number; esquejes: number }): { message: string; tone: 'success' | 'error' }`

- [ ] **Step 1: Tests:** riego con 3 → "¡Tarea completada! Se anotó el riego de 3 plantas."; cambio de etapa con 0 cambiadas → contiene "ya estaban en Floración"; cosechar 2 + 2 fichas → contiene "pasaron a Secado"; muerta 1 → "1 planta se archivó."; poda con logs 4 → "Quedó en la bitácora de 4 plantas."; mudanza con unplaced → contiene "no se movió"; problemas → tone 'error' y contiene el problema; plants 0 sin mudanza → contiene "ninguna planta activa". `describeReopen({ kept: 0, failures: 0, esquejes: 0 })` → "Listo, se deshizo la tarea."; kept 2 → menciona que 2 cambios no se tocaron porque cambiaron después; esquejes 3 → "Los 3 esquejes creados se mantienen."; failures → tone 'error'.
- [ ] **Step 2–4:** fallan → implementar (mover acá `feedMessage` y `ambienteMessage` de `AgendaList`) → pasan.
- [ ] **Step 5:** Commit `feat(tareas): avisos que cuentan lo que hizo cada tarea`.

### Task 4: Escrituras compartidas

**Files:**
- Create: `app/lib/plant-writes.ts` (`import 'server-only'`)
- Modify: `app/actions/plants.ts` (`bulkChangeStage`, `bulkWaterPlants`, `bulkSetArchived`, `bulkMoveToCycle`; se borra `logForEachPlant`), `app/cycles/actions.ts` (`moveCycleToSpace`)

**Interfaces:**
- Produces:
  - `interface PlantRef { id: number; cycle_id: number | null }`
  - `interface LogEntry { type: string; title: string; notes?: string | null; data?: Record<string, unknown> | null }`
  - `writePlantLogs(supabase, userId, plants: PlantRef[], entry: LogEntry, createdAt: string, taskId?: number): Promise<number[]>` (ids; error al log del servidor)
  - `writeCycleLog(supabase, userId, cycleId: number, entry: LogEntry, createdAt: string, taskId?: number): Promise<number | null>`
  - `setPlantsStage(supabase, ids: number[], stage: StageName, timestamp: string): Promise<{ error: unknown }>`
  - `setPlantsWatered(supabase, ids, day: string)`, `setPlantsArchived(supabase, ids, archived: boolean)`, `setPlantsCycle(supabase, ids, cycleId: number | null)`, `setCycleSpace(supabase, cycleId, spaceId: number | null)` → `Promise<{ error: unknown }>`
- Consumes: `stageLogTitle`, `cycleMoveTitle` (Task 1).

- [ ] **Step 1:** Crear el módulo y pasar las cuatro acciones en lote y `moveCycleToSpace` a usarlo, con los mismos registros que hoy.
- [ ] **Step 2:** `npm run typecheck && npm test` → limpio.
- [ ] **Step 3:** Commit `refactor(plantas): escrituras compartidas con la bitácora`.

### Task 5: Completar y desmarcar en el servidor

**Files:**
- Modify: `app/actions/tasks.ts`

**Interfaces:**
- Consumes: Tasks 1–4; `loadMixSources`, `readStoredMix`, `buildFeedLog`, `parseHarvestInput`, `delete_task_logs`, `move_fertilizer_stock`.
- Produces:
  - `completeTask(rawTaskId: string | number, input?: { doneOn?: unknown; liters?: unknown; deductStock?: unknown; weights?: unknown; note?: unknown; spaceId?: unknown; cycleId?: unknown; newCycleName?: unknown }): Promise<{ error: string } | { success: true; message: string; tone: 'success' | 'error'; canUndo: boolean }>`
  - `reopenTask(rawTaskId: string | number): Promise<{ error: string } | { success: true; message: string; tone: 'success' | 'error' }>`
  - `getCompletionContext(rawTaskId): Promise<{ error: string } | { plants: { id: number; name: string }[]; ambiente: null | { spaceId: number | null; spaceName: string | null; spaces: { id: number; name: string }[]; needsCycle: boolean; cycles: { id: number; name: string }[]; suggestedCycleName: string } }>`
  - `getSpaceOptions(): Promise<{ id: number; name: string }[]>`
  - Se borran `toggleTaskStatus`, `undoTaskCompletion`, `applyTaskCompletionEffect`, `TaskCompletionEffects`, `AmbienteMoveResult`, `FeedResult`.

- [ ] **Step 1: `completeTask`.** Orden: leer tarea → rechazar esquejado ("Completá el esquejado desde su ventana."), cambio de etapa sin etapa válida ("Elegí la etapa de destino desde Editar.") y ambiente sin destino ni `spaceId` ("Elegí a qué espacio se muda.") → validar `doneOn` (día ≤ hoy; "El día no puede ser después de hoy.") → guardar `target_space_id` si vino `spaceId` → cambio de estado condicional con `completed_at` = fecha del efecto → plantas con `loadTaskPlants` → aplicar etapa (sólo `shouldApplyStage`), riego, archivado, fichas de cosecha (sólo plantas sin ficha; `harvested_on` = día; `wet_g` de `weights[plantId]`), mudanza (ciclo nuevo si `newCycleName`; `chosenCycleId`), mezcla → un registro por planta con `logTitleFor` (cambio de etapa: sólo las que cambiaron; mudanza: uno por ciclo y uno por planta pasada; fertilizante con mezcla: el de la mezcla; muerta: notas = descripción + motivo) → guardar `last_effect` con lo escrito → `describeCompletion`. Cada paso que falla suma un texto a `problems`.
- [ ] **Step 2: `reopenTask`.** Cambio de estado condicional a pendiente; con `last_effect`: borrar registros (`delete_task_logs`), devolver stock, y revertir con filtro de "sigue igual": riego `.eq('last_water', waterSet)`, etapa `.eq('stage', set.stage).eq('stage_updated_at', set.at)`, archivado `.eq('is_archived', true)`, fichas `.is('dry_g', null)`, plantas `.eq('cycle_id', to)`, ciclos `.eq('space_id', to)`, ciclo creado borrado si quedó sin plantas, fotos ni mediciones. Sin `set`/`to` (viejos): revertir sin filtro. Contar lo que no se tocó (`kept`) → `describeReopen`.
- [ ] **Step 3: Esquejado.** `getEsquejadoCandidates` y `completeEsquejado` resuelven madres con los objetivos de la tarea (`getTaskTargets` + plantas no archivadas), no con `task_cycles`. Con esquejes creados, un registro `esquejado` por madre: "Esquejado: N esquejes".
- [ ] **Step 4:** `npm run typecheck` (fallará `AgendaList` hasta la Task 6; el resto limpio).
- [ ] **Step 5:** Commit junto con la Task 6.

### Task 6: Hoja de completar y agenda

**Files:**
- Create: `components/CompleteTaskSheet.tsx`
- Modify: `components/AgendaList.tsx`
- Delete: `components/FeedCompleteModal.tsx`

**Interfaces:**
- Consumes: `completionNeeds` (Task 1), `completeTask`, `reopenTask`, `getCompletionContext` (Task 5).
- Produces: `CompleteTaskSheet({ task, onClose, onSubmit }: { task: Task; onClose: () => void; onSubmit: (input: CompleteTaskInput) => Promise<void> })`.

- [ ] **Step 1:** Hoja con secciones según `completionNeeds`: día ("¿Qué día la hiciste?", hoy por defecto, atajos Hoy/Ayer/día agendado, máximo hoy); mezcla (lo de `FeedCompleteModal`); pesos húmedos por planta (opcional); mudanza (destino si falta, ciclo o ciclo nuevo si `needsCycle`, texto de confirmación); muerta (confirmación y "Motivo", opcional).
- [ ] **Step 2:** `AgendaList`: completar → esquejado a su modal; con `any` → hoja; si no, `completeTask` directo. Desmarcar → con `last_effect` pide confirmación ("Se deshacen los cambios que hizo"); `reopenTask`. "Deshacer" del aviso → `reopenTask`. Borrar `CONFIRM_ON_COMPLETE` y los textos movidos a `task-outcome`.
- [ ] **Step 3:** `npm run lint && npm run typecheck && npm test` → limpio.
- [ ] **Step 4:** Commit `feat(tareas): completar con efectos y registro; desmarcar deshace`.

### Task 7: Editar sin contradicciones

**Files:**
- Modify: `app/actions/tasks.ts` (`updateTask`), `components/EditTaskModal.tsx`

**Interfaces:**
- Produces: `updateTask(rawTaskId, rawUpdates, scope?: 'single' | 'all_future')` (sin el cuarto parámetro); acepta `target_space_id`.

- [ ] **Step 1:** Servidor: completada → sólo notas (en fertilizante con mezcla, la receta se conserva). Pendiente → título del tipo salvo "Otro"; `target_space_id` en ambiente (validado contra los espacios del usuario); serie: sólo las pendientes, y el destino se copia a las pendientes de la serie.
- [ ] **Step 2:** Modal: título sólo en "Otro" (si no, el tipo como encabezado); espacio destino en ambiente (`getSpaceOptions`); completada → sólo notas y el aviso "Está completada: para cambiar el día o lo que hace, primero desmarcala."
- [ ] **Step 3:** `npm run lint && npm run typecheck` → limpio.
- [ ] **Step 4:** Commit `feat(tareas): editar sin contradecir lo que la tarea ya hizo`.

### Task 8: Vistas y código muerto

**Files:**
- Modify: `app/plants/[id]/page.tsx`, `app/calendar/page.tsx`, `components/TaskPill.tsx`, `app/lib/logs.ts` (si `LOG_TYPE.harvest` queda sin uso)
- Create: `supabase/migrations/20261107180000_efectos_de_tareas.sql` (`drop function if exists public.update_task_series(bigint, text, text, text, text, date);`)
- Modify: `docs/PENDIENTES.md` (pruebas de tareas)

- [ ] **Step 1:** Ficha: no mostrar en el historial las tareas completadas cuyo id aparece en `data.task_id` de sus registros. Agenda: no pasar los registros con `data.task_id`.
- [ ] **Step 2:** `TaskPill` sin `onDelete` ni `readOnly`.
- [ ] **Step 3:** `npm run lint && npm run typecheck && npm test && npm run build` → limpio.
- [ ] **Step 4:** Commit `chore(tareas): vistas sin duplicados y fuera el código muerto`.
