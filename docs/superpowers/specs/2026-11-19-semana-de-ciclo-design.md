# Semana de ciclo: saber en qué momento está el cultivo y agendar sin contar

Fecha: 2026-11-19 · Estado: diseño para aprobar

## Por qué

La pregunta que más se hace al abrir la app es **"¿en qué momento del ciclo están las plantas hoy?"**, y hoy la app no la responde:

- El panel y la cabecera del ciclo muestran "Día N" desde `cycles.start_date`. Ese número no sirve para nada en la práctica.
- La agenda y el calendario no dicen en qué semana de etapa cae cada día.
- Para agendar las tareas de flora hay que contar a mano las semanas desde el pase a flora, y lo mismo para saber en qué semana se está hoy.

El cultivador trabaja con una referencia de **~8 semanas de flora**. Es una referencia, no una fecha fija: la cosecha se decide mirando las plantas, que pueden ir antes o después. Las tareas se crean a mano, una por una. Las podas, defoliaciones, etc. suele conocerlas aproximadamente desde el arranque del ciclo, pero **cambian de un ciclo a otro**.

## Objetivos

1. En el panel y en el ciclo, ver de un vistazo **"Flora · semana 4 de ~8 · día 24"**, o "Vege · semana 3", y la cosecha aproximada.
2. Agendar una tarea eligiendo **"Flora · semana 6 · día 1"** en lugar de una fecha, y al elegir una fecha ver en qué semana cae.
3. Ver en la agenda y el calendario la semana de cada día ("F4"), y en el ciclo una tira de semanas con el hoy y los hitos.
4. En el plan de cultivo, sumar tareas propias (poda, entrenamiento, defoliación, repelente, otro…) ubicadas por semana de etapa, junto con lo que el plan ya genera.

## No objetivos

- **Mover tareas automáticamente** cuando cambia el pase a flora o la cosecha. Las tareas creadas quedan en su fecha: si se adelanta la cosecha, las sobrantes se borran a mano; si se atrasa la flora, igual hay que hacerlas.
- **Plantillas o memoria entre ciclos** para las tareas propias del plan. Se cargan en el momento, cada vez.
- Guardar la semana en cada tarea. La semana se calcula siempre al vuelo desde la fecha real del pase a flora.

## Anti-objetivos (fracasos aunque "funcione")

- Tratar las 8 semanas como un plazo: nada de alarmas, rojos ni "atrasado". Pasada la meta se muestra "semana 9 · 1 más que lo previsto", en tono neutro.
- Que el panel siga obligando a contar o a entrar al ciclo para saber la semana.
- Que la semana que muestra el formulario de tarea no coincida con la semana que usa para la dosis. En el formulario, la semana mostrada es exactamente la de la dosis.

## Convenciones

- **Semana de etapa:** la que ya usa la app para las dosis (`weekInStage` en `app/lib/nutrition.ts`). El día del cambio de etapa es el día 0 de la semana 1; la semana N empieza en el día (N−1)·7. "Día 24" es el día en la etapa (0 = el día del pase).
- **Inicio de la etapa del ciclo:** la misma lógica que ya usan `app/cycles/[id]/page.tsx` y `app/actions/grow-plan.ts`: la etapa dominante (`dominantStage`) y la fecha más temprana de esa etapa entre las plantas activas (`stagePeriods`), con `stage_updated_at` como respaldo. *(Decisión de diseño: se reusa la lógica existente, que toma la fecha más temprana y no la de la mayoría. En la práctica el ciclo pasa a flora junto.)*
- **Semana del ciclo vs. semana de dosis.** La cabecera, el panel, la agenda y la tira usan la semana del ciclo (inicio de etapa según la regla anterior). La dosis sigue calculándose como hoy: por planta, o con el promedio del ciclo (`buildTaskTargetOptions` / `feedContext`). Así no cambian las dosis de nadie. En el formulario, el rótulo "cae en F6" y el modo "Por semana" usan la misma cuenta que la dosis del objetivo elegido. Si todas las plantas pasaron a flora el mismo día, que es el caso normal, las dos cuentas coinciden. *(Decisión de diseño.)*
- **Pase real vs. previsto:** apenas alguna planta activa del ciclo tiene `date_floracion`, el inicio de flora es la fecha real más temprana y `planned_flower_start` se ignora. La etapa que se muestra sigue siendo la dominante. *(Decisión de diseño: un pase real, aunque sea parcial, es mejor dato que un plan.)*
- **Abreviaturas:** V para vegetativo y F para floración ("F4"). Las etapas previas (germinación, plántula, enraizamiento) se muestran por nombre, sin semana. Secado y curado muestran "Secado · día N".

## Cómo está hoy (lo que se toca)

- `components/CycleStatusCard.tsx`: muestra "Día {days}", con `days` calculado en `components/DashboardData.tsx` (`daysSince(cycle.start_date)`).
- `app/cycles/[id]/page.tsx`: la cabecera muestra "Día de cultivo". Ya calcula `cycleStage`, `stageStart` y `estimateHarvest` (solo en flora, con el promedio de la genética o `DEFAULT_FLOWER_DAYS = 63`).
- `app/lib/harvest.ts`: `estimateHarvest`, `DEFAULT_FLOWER_DAYS`.
- `app/lib/grow-plan.ts` + `components/GrowPlanModal.tsx` + `app/actions/grow-plan.ts`: el plan genera riego, fertilizante, cambio de etapa, lavado y cosecha. La vista previa ya agrupa por semana de calendario y dice "semana N de floración".
- `components/AddTaskModal.tsx`: la fecha es un `DateField` y ya calcula los días en etapa del objetivo (`feedContext`) para la dosis.
- `app/calendar/*` (`CalendarView`, `AgendaList`, `CalendarWidget`): la agenda agrupa por día y no muestra la semana.
- `cycles` tiene una columna `estimated_harvest` que hoy no usa nadie.

## Enfoques considerados

- **A. La semana de ciclo en toda la app (elegido).** Un cálculo compartido más una meta de flora por ciclo, aplicado en el panel, el ciclo, la agenda, el formulario de tarea y el plan, en etapas que sirven por sí solas. Es el único que resuelve las dos cosas: saber dónde se está y planificar sin contar.
- **B. Solo mostrar dónde se está.** Es lo más rápido, pero agendar sigue igual de trabajoso. Descartado.
- **C. Plantillas de flora reutilizables.** Ahorra trabajo solo si la rutina se repite entre ciclos, y no es el caso. Descartado por ahora.

Además, a pedido del cultivador: **el plan de cultivo admite tareas propias** ubicadas por semana de etapa (abajo, etapa 4).

## Diseño

### Modelo de datos

Migración nueva en `supabase/migrations/` que agrega a `cycles`:

- `flower_target_weeks smallint not null default 8`, con check 1–30. La meta de flora del ciclo.
- `planned_flower_start date null`. El pase a flora previsto mientras el ciclo está en vege. Lo escribe el plan de cultivo al crearse y se puede editar desde el ciclo. Cuando hay un pase a flora real (fecha de floración en las plantas), manda el real y este campo se ignora.

Se regeneran los tipos (`app/lib/database.types.ts`). Las políticas RLS de `cycles` no cambian (son por dueño de la fila). `estimated_harvest` no se usa ni se borra en este trabajo. *(Decisión de diseño: la cosecha aproximada se calcula siempre como inicio de flora + meta, así no queda un dato guardado que se desactualice.)*

### Pieza central: `app/lib/cycle-week.ts` (pura, con tests)

- `cycleTimeline(input)`: recibe la etapa del ciclo, el inicio de etapa, `flower_target_weeks`, `planned_flower_start` y el día de hoy. Devuelve:
  - `stage`, `week`, `dayInStage`
  - `flowerStart` (real o previsto, y cuál de los dos es)
  - `targetWeeks`, `harvestApprox` (flowerStart + targetWeeks·7 días), `weeksLeft`
  - `overTarget` (semanas de más, ≥ 0)
- `weekLabel(day, timeline)` para cualquier día, pasado o futuro: `{ short: "F4", long: "Flora · semana 4 · día 24" }`. Se usa en la agenda, el calendario y el formulario. Para días futuros en vege con pase previsto, los días posteriores al pase previsto se rotulan como flora.
- `dayForStageWeek(stage, week, dayOfWeek, timeline)`: la conversión inversa, "F6 día 1" → fecha. Devuelve null si falta el inicio de esa etapa (real o previsto).
- Usa `weekInStage` / `stageDaysForWeek`, para que la semana mostrada y la de la dosis sean la misma.
- Tests: semana 1 en el día 0, cambio de semana en el día 7, meta superada, vege con y sin pase previsto, etapas previas, secado.

`estimateHarvest` pasa a usar la meta del ciclo. El promedio de la genética, si hay datos (n ≥ 2), queda solo como dato informativo ("tu genética promedia 8,5 sem").

### Etapa 1: ver dónde estás (panel y ciclo)

- **Tarjeta del panel** (`CycleStatusCard`): reemplaza "Día N" por la etapa y la semana como dato principal ("Flora · sem 4 de ~8"), una barra fina de progreso de flora y debajo "cosecha aprox. 23 dic". En vege: "Vege · sem 3", y si hay pase previsto, "flora aprox. 2 dic". El día total de cultivo puede quedar como dato secundario o desaparecer *(decisión del implementador; recomendado: quitarlo de la tarjeta)*. El cálculo se hace en el servidor, como hoy `days`.
- **Cabecera del ciclo** (`app/cycles/[id]/page.tsx`): el número grande pasa a ser la semana de etapa ("Flora · semana 4 de ~8 · día 24"), con el progreso y la cosecha aproximada. "Día de cultivo" queda como dato chico. Al lado de la meta, una acción para editar "meta de flora" (semanas) y, en vege, "pase a flora previsto" (fecha). Hacen falta server actions nuevas con validación del lado del servidor.
- Pasada la meta: "semana 9 · 1 más que lo previsto", sin color de alerta.

Boceto de la tarjeta:

```
┌────────────────────────────────────┐
│ Ciclo Invierno               ↗     │
│ Flora · sem 4 de ~8                │
│ ▓▓▓▓▓▓▓▓░░░░░░░░  cosecha ~23 dic  │
│ 6 plantas · Carpa 1                │
└────────────────────────────────────┘
```

### Etapa 2: agendar sin contar (formulario de tarea)

- En `AddTaskModal` (y en `EditTaskModal` para que sea consistente), junto al `DateField`, un modo **"Por semana"**: etapa (Vege / Flora) × semana (stepper) × día de la semana de etapa (1–7). Muestra la fecha resultante ("→ jue 4 dic"). El modo calendario sigue siendo el de siempre.
- En modo calendario, debajo de la fecha elegida, una línea "cae en Flora · semana 6 · día 36".
- El ciclo de referencia sale del objetivo elegido (ciclo o plantas). Si el objetivo abarca varios ciclos con distinto inicio, el modo "Por semana" se deshabilita con una explicación breve. Si no hay inicio de flora (ni real ni previsto), la opción Flora se deshabilita con "cargá el pase a flora previsto en el ciclo".
- La fecha que se guarda es una fecha común. No se guarda la semana (ver No objetivos).
- La semana de dosis que ya calcula el formulario sigue igual y coincide con lo mostrado.

### Etapa 3: agenda, calendario y línea de tiempo

- **Agenda y calendario** (`CalendarView`, `AgendaList`, `CalendarWidget`): cada día muestra su rótulo corto ("F4") por cada ciclo activo. Con un solo ciclo activo, el rótulo va en el encabezado del día. Con varios, va en cada tarea, según el ciclo de la tarea.
- **Tira de semanas en el ciclo** (`CycleDetailView` o un componente nuevo): V1…Vn | F1…F{meta} (y semanas extra si se pasó), con el hoy marcado y marcas de hitos (pase a flora, lavado, cosecha) y cantidad de tareas pendientes por semana. Tocar una semana lleva a la agenda filtrada por esas fechas *(decisión del implementador: si filtrar por rango es costoso, abrir el calendario en ese día)*.

### Etapa 4: plan de cultivo con tareas propias

- En `GrowPlanModal`, una sección nueva **"Tus tareas"**: agregar filas con tipo (poda, entrenamiento, repelente, trasplante, otro…; de `TASK_TYPES`, salvo los que el plan ya genera y los que no tienen sentido planificar, como "declarar muerta"), etapa (Vege/Flora), semana, día de la semana de etapa (1–7, 1 por defecto) y una nota opcional.
- `buildGrowPlan` recibe esas filas y las convierte en `PlanItem` con la fecha que corresponde según `vegStart` / `flowerStart` del plan. Aparecen en la vista previa mezcladas y destildables como el resto. Las que caen antes de hoy o después de la cosecha se muestran avisadas y no se crean.
- `app/actions/grow-plan.ts` valida los tipos del lado del servidor (lista permitida), los límites (semana 1–30, día 1–7, nota acotada) y que el total respete `MAX_PLAN_ITEMS`.
- Al crear el plan se guarda `flower_target_weeks` (las semanas elegidas) y, si el ciclo está en vege, `planned_flower_start = flowerStart`, para que el resto de la app use lo mismo.
- La duración de flora del plan pasa a elegirse **en semanas enteras** (stepper de semanas) y propone por defecto la meta del ciclo (8). Así la meta guardada, la "cosecha aprox." y la tarea de cosecha del plan caen siempre el mismo día. `DEFAULT_FLOWER_DAYS` pasa a 56 o se deriva de la meta. *(Decisión de diseño.)*
- Las tareas creadas son normales y llevan `metadata.plan_cycle_id` como las demás del plan, así "Borrar el plan" las incluye.

## Orden de entrega

1. Migración + `cycle-week.ts` con tests + etapa 1.
2. Etapa 2.
3. Etapa 3.
4. Etapa 4.

Cada etapa se puede publicar por separado.

## Restricciones

- Fechas en días de calendario de Argentina con los helpers de `app/lib/dates.ts` (`todayKey`, `addDaysToKey`, `daysBetweenKeys`). Nada de husos sueltos.
- Lógica pura en `app/lib/` con tests `node --test` como el resto. Escrituras validadas en server actions y nunca confiando en lo que manda el cliente.
- Textos en español rioplatense, con el tono del resto de la app.
- Táctil primero: nada escondido detrás de hover.

## Queda para el implementador

- Diseño visual fino de la barra de progreso, la tira de semanas y el modo "Por semana", dentro del sistema existente (`surface`, `chip`, `metric`, componentes de `components/ui/form`).
- Si la edición de meta y pase previsto va en un modal chico o en línea.
- Nombres de componentes y archivos nuevos.
