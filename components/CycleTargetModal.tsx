'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Target } from 'lucide-react'
import { updateCycleSchedule } from '@/app/cycles/actions'
import { useToast } from '@/app/context/ToastContext'
import { addDaysToKey, todayKey } from '@/app/lib/dates'
import { MAX_FLOWER_WEEKS, MIN_FLOWER_WEEKS } from '@/app/lib/cycle-week'
import Modal from '@/components/ui/Modal'
import { DateField, Field, FormActions, FormAlert, Stepper } from '@/components/ui/form'

interface CycleTargetModalProps {
  cycleId: number
  targetWeeks: number
  plannedFlowerStart: string | null
  /** Ya hay plantas en flora: manda esa fecha y el previsto no se usa. */
  flowerStarted: boolean
  /** Lo que promedia la genética en flora, como dato. */
  strainFlowerWeeks: number | null
}

/**
 * La meta de flora (semanas) y el pase a flora previsto. Son referencias para
 * contar semanas y estimar la cosecha: cambiarlas no mueve ninguna tarea.
 */
export default function CycleTargetModal({ cycleId, targetWeeks, plannedFlowerStart, flowerStarted, strainFlowerWeeks }: CycleTargetModalProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [weeks, setWeeks] = useState(targetWeeks)
  const [planned, setPlanned] = useState(plannedFlowerStart ?? '')
  const [saving, setSaving] = useState(false)

  const open = () => {
    setWeeks(targetWeeks)
    setPlanned(plannedFlowerStart ?? '')
    setIsOpen(true)
  }

  const save = async () => {
    setSaving(true)
    const res = await updateCycleSchedule(cycleId, { flowerTargetWeeks: weeks, plannedFlowerStart: flowerStarted ? plannedFlowerStart : planned || null })
    setSaving(false)
    if (res.error) {
      showToast(res.error, 'error')
      return
    }
    showToast('Meta del ciclo guardada')
    setIsOpen(false)
    router.refresh()
  }

  const today = todayKey()

  return (
    <>
      <button type="button" className="btn btn-sm btn-ghost" onClick={open}>
        <Target size={15} aria-hidden="true" />
        Meta de flora
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Meta de flora"
        description="Para contar las semanas y estimar la cosecha. Cambiarla no mueve ninguna tarea."
        footer={
          <FormActions
            onSubmit={save}
            onCancel={() => setIsOpen(false)}
            icon={Target}
            pending={saving}
            pendingLabel="Guardando…"
            submitLabel="Guardar"
          />
        }
      >
        <div className="space-y-5">
          <Field
            label="Semanas de flora"
            hint={strainFlowerWeeks ? `Tu genética promedia ${strainFlowerWeeks.toLocaleString('es-AR')} semanas.` : 'Es aproximado: la cosecha la decidís mirando las plantas.'}
          >
            <Stepper value={weeks} onChange={setWeeks} min={MIN_FLOWER_WEEKS} max={MAX_FLOWER_WEEKS} suffix="semanas" unitName="semana" />
          </Field>

          {flowerStarted ? (
            <FormAlert tone="info">Las plantas ya pasaron a flora: las semanas se cuentan desde ese día.</FormAlert>
          ) : (
            <div className="space-y-2">
              <DateField
                label="Pase a flora previsto"
                optional
                value={planned}
                onChange={setPlanned}
                quick={[
                  { label: 'En 1 semana', value: addDaysToKey(today, 7) },
                  { label: 'En 2 semanas', value: addDaysToKey(today, 14) },
                  { label: 'En 3 semanas', value: addDaysToKey(today, 21) },
                ]}
                hint="Con esta fecha podés agendar tareas por semana de flora desde ahora."
              />
              {planned && (
                <button type="button" className="text-[0.8125rem] font-semibold text-[color:var(--brand-text)] hover:underline" onClick={() => setPlanned('')}>
                  Quitar la fecha
                </button>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
