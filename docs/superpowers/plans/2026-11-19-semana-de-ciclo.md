# Semana de ciclo — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la app diga en qué semana de etapa está cada ciclo y deje agendar y planificar por semana de etapa.

**Architecture:** Un módulo puro `app/lib/cycle-week.ts` calcula la línea de tiempo del ciclo (etapa, semana, inicio de flora real o previsto, meta, cosecha aprox.) y convierte día ↔ semana. Lo consumen la página del ciclo, el panel, la agenda (a través de `CycleOption.timeline`), el formulario de tarea y el plan de cultivo. La meta y el pase previsto se guardan en dos columnas nuevas de `cycles`.

**Tech Stack:** Next.js 16 (server components + server actions), Supabase, TypeScript, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-19-semana-de-ciclo-design.md`

## Global Constraints

- Días de calendario de Argentina con `app/lib/dates.ts`; nunca `new Date()` para aritmética de días.
- Semana N = días en etapa (N−1)·7 … N·7−1 (`weekInStage` / `stageDaysForWeek`).
- `flower_target_weeks` 1–30, default 8. `planned_flower_start` date nullable.
- Textos en español rioplatense; nada de alarmas al pasar la meta.
- Las lecturas toleran la ausencia de las columnas nuevas (`select('*')`, defaults en código).

## Review Focus

- Ciclo sin fecha de etapa (solo `stage`): sin semana, sin romper la tarjeta.
- Ciclo en vege sin pase previsto: el modo "Flora" del formulario queda deshabilitado con explicación.
- Meta superada: "semana 9 · 1 más que lo previsto", sin color de alerta.
- Tarea propia del plan antes de hoy o después de la cosecha: se avisa y no se crea.
- Ciclo con plantas en flora parcial: el inicio de flora es el real más temprano.

---

### Task 1: Migración + `cycle-week.ts`

**Files:** Create `supabase/migrations/20261119120000_semana_de_ciclo.sql`, `app/lib/cycle-week.ts`, `app/lib/cycle-week.test.ts`. Modify `app/lib/database.types.ts`, `app/lib/harvest.ts` (`DEFAULT_FLOWER_WEEKS = 8`, `DEFAULT_FLOWER_DAYS = 56`).

**Produces:**
- `interface CycleWeekRef { stage: StageName | null; stageStart: string | null; vegStart: string | null; flowerStart: string | null; flowerPlanned: boolean; targetWeeks: number }`
- `cycleWeekRef(plants, cycle: { flower_target_weeks?, planned_flower_start? }): CycleWeekRef`
- `interface CycleTimeline extends CycleWeekRef { week: number | null; dayInStage: number | null; harvestApprox: string | null; weeksLeft: number | null; overTarget: number }`
- `cycleTimeline(ref, today): CycleTimeline`
- `stageWeekOn(day, ref): { stage: 'Vegetativo' | 'Floración'; week: number; dayInStage: number } | null`
- `weekLabel(day, ref): { short: string; long: string } | null`
- `dayForStageWeek(stage, week, dayOfWeek, ref): string | null`

- [ ] Tests: semana 1 en el día 0 y 2 en el día 7; flora real gana al previsto; vege con pase previsto rotula F después; meta superada; sin fechas → null.
- [ ] Implementar, correr `npm test`, commit.

### Task 2: Panel y cabecera del ciclo + edición de meta

**Files:** Create `components/CycleWeekSummary.tsx`, `components/CycleTargetModal.tsx`; modify `components/CycleStatusCard.tsx`, `components/DashboardData.tsx`, `app/cycles/[id]/page.tsx`, `app/cycles/actions.ts` (`updateCycleSchedule(cycleId, { flowerTargetWeeks, plannedFlowerStart })`).

- [ ] Tarjeta: etapa · semana de ~meta, barra, cosecha aprox. Sin "Día N".
- [ ] Cabecera: semana grande, día de cultivo chico, estimación con la meta y la genética como dato.
- [ ] Server action validada (1–30, fecha válida o null). Typecheck, commit.

### Task 3: Formulario de tarea "Por semana"

**Files:** Modify `app/lib/task-targets.ts` (+ `timeline: CycleWeekRef | null` en `CycleOption`, `targetWeekRef(targets, plants, cycles)`), su test, `components/AddTaskModal.tsx`; create `components/StageWeekPicker.tsx`.

- [ ] Modo calendario/semana; línea "cae en …"; Flora deshabilitada sin inicio; varios ciclos con distinto inicio → deshabilitado.
- [ ] En modo semana, la dosis usa los días de la semana elegida. Tests, commit.

### Task 4: Agenda y tira de semanas

**Files:** Modify `components/CalendarView.tsx`, `components/CalendarWidget.tsx`; create `components/CycleWeekStrip.tsx`; modify `app/cycles/[id]/page.tsx`.

- [ ] Celda: rótulo "F4" el primer día de cada semana de etapa, con un ciclo en foco. Detalle del día: rótulo largo por ciclo.
- [ ] Tira V…F con hoy, hitos y pendientes por semana; tocar lleva a `/calendar?mes=&dia=`. Commit.

### Task 5: Plan de cultivo con tareas propias y semanas enteras

**Files:** Modify `app/lib/grow-plan.ts` (+ `custom?: CustomPlanTask[]`, `PlanItem.type` admite tipos propios, `PlanItem.note`, `skipped` para fuera de rango), su test, `components/GrowPlanModal.tsx`, `app/actions/grow-plan.ts`.

- [ ] `CustomPlanTask { id: string; type: CustomPlanType; stage: 'Vegetativo' | 'Floración'; week: number; day: number; note?: string }`; `CUSTOM_PLAN_TYPES = ['poda','entrenamiento','repelente','trasplante','otro']`.
- [ ] Flora en semanas (stepper), default meta del ciclo. El servidor valida tipos/límites, guarda `flower_target_weeks` y `planned_flower_start`. Tests, commit.

### Task 6: Verificación y entrega

- [ ] `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- [ ] Aplicar la migración en Supabase, push a la rama y a `main`.
