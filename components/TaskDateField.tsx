'use client'

import { useEffect, useState } from 'react'
import { daysBetweenKeys, formatInAppTz, todayKey } from '@/app/lib/dates'
import { dayForStageWeek, stageWeekOn, weekLabel } from '@/app/lib/cycle-week'
import type { CycleWeekRef, WeekStage } from '@/app/lib/cycle-week'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { ChoiceGroup, DateField, Field, FormAlert, Stepper, relativeDay } from '@/components/ui/form'

export interface WeekSelection {
  stage: WeekStage
  week: number
  /** Día dentro de la semana de etapa, de 1 a 7. */
  day: number
}

interface TaskDateFieldProps {
  date: string
  onDateChange: (date: string) => void
  /** Desde cuándo cuentan las semanas de lo elegido, o null con la razón. */
  weekRef: CycleWeekRef | null
  weekReason: string | null
  /** La semana elegida en modo "Por semana" (null en modo calendario). */
  onSelectionChange?: (selection: WeekSelection | null) => void
}

type Mode = 'day' | 'week'

/**
 * El día de una tarea: en el calendario, como siempre, o por semana de etapa
 * ("flora, semana 6, día 1"), y la app hace la cuenta. En el calendario dice
 * en qué semana cae el día elegido.
 */
export default function TaskDateField({ date, onDateChange, weekRef, weekReason, onSelectionChange }: TaskDateFieldProps) {
  const [mode, setMode] = useState<Mode>('day')
  const [selection, setSelection] = useState<WeekSelection>({ stage: 'Floración', week: 1, day: 1 })

  const canVeg = Boolean(weekRef?.vegStart)
  const canFlower = Boolean(weekRef?.flowerStart)
  const label = weekRef ? weekLabel(date, weekRef) : null

  const apply = (next: WeekSelection) => {
    setSelection(next)
    onSelectionChange?.(next)
    const day = weekRef ? dayForStageWeek(next.stage, next.week, next.day, weekRef) : null
    if (day) onDateChange(day)
  }

  const changeMode = (next: Mode) => {
    setMode(next)
    if (next === 'day') {
      onSelectionChange?.(null)
      return
    }
    if (!weekRef) return
    // Arranca en la semana del día que ya estaba elegido, si cae en una.
    const at = stageWeekOn(date, weekRef)
    const start: WeekSelection = at
      ? { stage: at.stage, week: at.week, day: (at.dayInStage % 7) + 1 }
      : { stage: canFlower ? 'Floración' : 'Vegetativo', week: 1, day: 1 }
    if ((start.stage === 'Floración' && !canFlower) || (start.stage === 'Vegetativo' && !canVeg)) return
    apply(start)
  }

  // Si cambia lo elegido (y con eso desde cuándo se cuenta), la fecha sigue
  // a la semana elegida.
  const refKey = `${weekRef?.vegStart}|${weekRef?.flowerStart}`
  useEffect(() => {
    if (mode !== 'week' || !weekRef) return
    const day = dayForStageWeek(selection.stage, selection.week, selection.day, weekRef)
    if (day && day !== date) onDateChange(day)
    // Solo cuando cambia la referencia: el resto ya lo hace `apply`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refKey])

  const weekModeReady = mode === 'week' && weekRef && (canVeg || canFlower)
  const diff = daysBetweenKeys(todayKey(), date)

  return (
    <div className="space-y-3">
      <SegmentedControl
        label="Cómo elegir el día"
        value={mode}
        onChange={changeMode}
        options={[
          { value: 'day', label: 'En el calendario' },
          { value: 'week', label: 'Por semana de etapa' },
        ]}
      />

      {mode === 'day' && (
        <DateField
          label="Día"
          value={date}
          onChange={onDateChange}
          quick="future"
          hint={label ? <span className="font-semibold text-fg">Cae en {label.long}{label.planned ? ' (según el pase previsto)' : ''}.</span> : undefined}
        />
      )}

      {mode === 'week' && !weekModeReady && (
        <FormAlert tone="info">{weekReason ?? 'Cargá la etapa de las plantas (con su fecha) para contar por semana.'}</FormAlert>
      )}

      {weekModeReady && (
        <div className="space-y-4 rounded-[var(--radius-lg)] border border-line p-4">
          <ChoiceGroup
            legend="Etapa"
            size="sm"
            options={[
              { value: 'Vegetativo' as const, label: 'Vege', disabled: !canVeg },
              { value: 'Floración' as const, label: 'Flora', disabled: !canFlower },
            ]}
            value={selection.stage}
            onChange={(stage) => apply({ ...selection, stage })}
            hint={!canFlower ? 'Para contar semanas de flora antes del pase, cargá el pase previsto en "Meta de flora" del ciclo.' : weekRef.flowerPlanned && selection.stage === 'Floración' ? 'Contando desde el pase a flora previsto.' : undefined}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Semana">
              <Stepper value={selection.week} onChange={(week) => apply({ ...selection, week })} min={1} max={30} unitName="semana" />
            </Field>
            <Field label="Día de la semana" hint="El 1 es el primer día de la semana de etapa.">
              <Stepper value={selection.day} onChange={(day) => apply({ ...selection, day })} min={1} max={7} unitName="día" />
            </Field>
          </div>
          <p className="rounded-[var(--radius-md)] bg-brand-soft px-3 py-2 text-sm text-fg" role="status">
            Queda el <strong>{formatInAppTz(date, { weekday: 'long', day: 'numeric', month: 'long' })}</strong> ({relativeDay(date).toLowerCase()}).
            {diff < 0 && ' Esa fecha ya pasó.'}
          </p>
        </div>
      )}
    </div>
  )
}
