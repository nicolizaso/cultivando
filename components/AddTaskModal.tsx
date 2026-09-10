'use client'

import { useState, useRef, useEffect } from 'react'
import {
  X, Sprout, FileText, Check, ChevronDown, Loader2, RefreshCw, AlertTriangle
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createTask } from '@/app/actions/tasks'
import DatePicker from './DatePicker'
import { useToast } from '@/app/context/ToastContext'
import { TASK_TYPES } from '@/app/lib/constants'
import Modal from '@/components/ui/Modal'

// Interfaces
import { Fertilizer, FertilizerCombo } from '@/app/lib/types'
import { getFertilizers, getFertilizerCombos } from '@/app/actions/fertilizers'

interface Plant { id: string; name: string; days_in_stage?: number; space_id?: number; }
interface Space { id: number; name: string; }

interface AddTaskModalProps {
  isOpen: boolean
  onClose: () => void
  plants: Plant[]
  spaces: Space[]
  cycles?: { id: number; name: string; space_id?: number }[]
  initialDate?: Date
}

export default function AddTaskModal({ isOpen, onClose, plants, spaces, cycles = [], initialDate }: AddTaskModalProps) {
  const router = useRouter()
  const { showToast } = useToast()

  const [selectedTargets, setSelectedTargets] = useState<{ id: string | number, name: string, type: 'plant' | 'space' | 'cycle' }[]>([])
  const [selectedTaskType, setSelectedTaskType] = useState<typeof TASK_TYPES[0] | null>(null)
  const [date, setDate] = useState(() => {
    const d = initialDate || new Date()
    return d.toLocaleDateString('en-CA')
  })

  useEffect(() => {
    if (initialDate) {
      setDate(initialDate.toLocaleDateString('en-CA'))
    }
  }, [initialDate])

  const [description, setDescription] = useState('')
  const [otherText, setOtherText] = useState('')
  const [applicationType, setApplicationType] = useState('Riego')
  const [targetStage, setTargetStage] = useState('Vegetativo')
  const [targetSpaceId, setTargetSpaceId] = useState<number | ''>('')

  // Nutrición (Fertilizantes)
  const [fertilizers, setFertilizers] = useState<Fertilizer[]>([])
  const [combos, setCombos] = useState<FertilizerCombo[]>([])
  const [selectedNutrition, setSelectedNutrition] = useState<{ type: 'product' | 'combo', id: number } | null>(null)
  const [isNutritionLoading, setIsNutritionLoading] = useState(false)

  // Recurrencia
  const [isRecurring, setIsRecurring] = useState(false)
  const [frequency, setFrequency] = useState('daily')
  const [endDate, setEndDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    return d.toLocaleDateString('en-CA')
  })

  const [isTargetOpen, setIsTargetOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const targetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isTargetOpen) return
    function handleClickOutside(event: MouseEvent) {
      if (targetRef.current && !targetRef.current.contains(event.target as Node)) setIsTargetOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isTargetOpen])

  // Carga de nutrición sólo cuando el tipo es fertilizante
  useEffect(() => {
    if (selectedTaskType?.id === 'fertilizante') {
      const loadNutrition = async () => {
        setIsNutritionLoading(true)
        try {
          const [fertRes, combosRes] = await Promise.all([getFertilizers(), getFertilizerCombos()])
          if (fertRes.data) setFertilizers(fertRes.data)
          if (combosRes.data) setCombos(combosRes.data)
        } catch (error) {
          console.error("Failed to load nutrition data", error)
        } finally {
          setIsNutritionLoading(false)
        }
      }
      loadNutrition()
    } else {
      setSelectedNutrition(null)
    }
  }, [selectedTaskType])

  // Al elegir nutrición se calcula la receta y se escribe en la descripción
  useEffect(() => {
    if (!selectedNutrition || selectedTargets.length === 0) return

    const target = selectedTargets[0]
    let weekInStage = 1

    if (target.type === 'plant') {
      const plantData = plants.find(p => p.id === target.id)
      if (plantData && plantData.days_in_stage) {
        weekInStage = Math.floor(plantData.days_in_stage / 7) + 1
      }
    }

    const generateRecipe = () => {
      const recipeStr = 'Preparar: '
      const items: string[] = []

      if (selectedNutrition.type === 'product') {
        const product = fertilizers.find(f => f.id === selectedNutrition.id)
        if (product) {
          if (product.dose_type === 'fija') {
            items.push(`${product.name}: ${product.dose_fixed}ml/L`)
          } else if (product.dose_weekly) {
            const weekDose = product.dose_weekly.find(w => w.week === weekInStage)
              || [...product.dose_weekly].sort((a,b)=>b.week-a.week)[0]
            items.push(`${product.name}: ${weekDose?.dose || 0}ml/L (Semana ${weekInStage})`)
          }
        }
      } else if (selectedNutrition.type === 'combo') {
        const combo = combos.find(c => c.id === selectedNutrition.id)
        if (combo && combo.products) {
          combo.products.forEach(p => {
            const product = fertilizers.find(f => f.id === p.fertilizer_id)
            if (product) {
              if (product.dose_type === 'fija') {
                items.push(`${product.name}: ${product.dose_fixed}ml/L`)
              } else if (product.dose_weekly) {
                const weekDose = product.dose_weekly.find(w => w.week === weekInStage)
                  || [...product.dose_weekly].sort((a,b)=>b.week-a.week)[0]
                items.push(`${product.name}: ${weekDose?.dose || 0}ml/L (Semana ${weekInStage})`)
              }
            } else {
              items.push(`${p.name}: ?ml/L`)
            }
          })
        }
      }

      return recipeStr + items.join(' + ')
    }

    const recipe = generateRecipe()
    setDescription(prev => {
      const lines = prev.split('\n');
      const recipeIndex = lines.findIndex(l => l.startsWith('Preparar:'));

      if (recipeIndex !== -1) {
        lines[recipeIndex] = recipe;
        return lines.join('\n');
      } else {
        if (!prev) return recipe;
        return `${recipe}\n\n${prev}`;
      }
    })
  }, [selectedNutrition, selectedTargets, fertilizers, combos, plants])

  const toggleTarget = (item: { id: string | number, name: string, type: 'plant' | 'space' | 'cycle' }) => {
    const exists = selectedTargets.find(t => t.id === item.id && t.type === item.type)
    if (exists) {
      setSelectedTargets(prev => prev.filter(t => !(t.id === item.id && t.type === item.type)))
    } else {
      setSelectedTargets(prev => [...prev, item])
    }
  }

  const removeTarget = (index: number) => {
    setSelectedTargets(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedTargets.length === 0) return showToast('Elegí al menos una planta, ciclo o espacio.', 'error')
    if (!selectedTaskType) return showToast('Elegí un tipo de tarea.', 'error')
    if (selectedTaskType.id === 'otro' && !otherText.trim()) return showToast('Escribí el nombre de la tarea personalizada.', 'error')
    if (isRecurring && !endDate) return showToast('Elegí una fecha de fin para la repetición.', 'error')

    setIsSubmitting(true)

    const cleanTaskType = {
      id: selectedTaskType.id,
      label: selectedTaskType.label
    }

    const result = await createTask({
      targets: selectedTargets,
      taskType: cleanTaskType,
      applicationType,
      targetStage,
      date: `${date}T12:00:00`, // Mediodía para evitar desfases de zona horaria
      description,
      otherText,
      isRecurring,
      frequency,
      endDate: isRecurring ? `${endDate}T12:00:00` : null
    })

    setIsSubmitting(false)

    if (result?.error) {
      showToast(result.error, 'error')
    } else {
      showToast('Tarea agendada', 'success')
      router.refresh()

      setSelectedTargets([])
      setSelectedTaskType(null)
      setDescription('')
      setOtherText('')
      setIsRecurring(false)
      onClose()
    }
  }

  const targetGroups: Array<{ key: string; label: string; items: { id: string | number; name: string }[]; type: 'cycle' | 'space' | 'plant'; icon?: React.ReactNode }> = [
    { key: 'cycles', label: 'Ciclos', items: cycles, type: 'cycle', icon: <RefreshCw size={14} aria-hidden="true" /> },
    { key: 'spaces', label: 'Espacios', items: spaces, type: 'space' },
    { key: 'plants', label: 'Plantas', items: plants, type: 'plant' },
  ]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Crear acción o evento"
      dismissOnBackdrop={false}
      footer={
        <button type="submit" form="add-task-form" className="btn btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Guardando...' : 'Guardar evento'}
        </button>
      }
    >
      <form id="add-task-form" onSubmit={handleSubmit} className="space-y-5">
        {/* 1. OBJETIVO */}
        <div className="field relative" ref={targetRef}>
          <span className="field-label" id="target-label">Objetivo</span>

          <button
            type="button"
            onClick={() => setIsTargetOpen(!isTargetOpen)}
            aria-expanded={isTargetOpen}
            aria-labelledby="target-label"
            className="flex min-h-[3rem] w-full flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-line-strong bg-surface-2 px-3 py-2 text-left transition-colors hover:border-[color:var(--fg-subtle)]"
          >
            <Sprout className="shrink-0 text-fg-muted" size={18} aria-hidden="true" />

            {selectedTargets.length === 0 ? (
              <span className="text-sm text-fg-subtle">Seleccionar planta, ciclo o espacio</span>
            ) : (
              <span className="text-sm text-fg">
                {selectedTargets.length} {selectedTargets.length === 1 ? 'objetivo' : 'objetivos'}
              </span>
            )}

            <ChevronDown
              size={16}
              className={`ml-auto text-fg-muted transition-transform ${isTargetOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>

          {/* Los objetivos elegidos viven fuera del disparador: así cada chip
              conserva su propio botón de quitar sin anidar botones. */}
          {selectedTargets.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {selectedTargets.map((target, idx) => (
                <li key={`${target.type}-${target.id}`}>
                  <span className="chip chip-brand">
                    {target.name}
                    <button
                      type="button"
                      onClick={() => removeTarget(idx)}
                      className="-mr-1 rounded-full p-0.5 hover:bg-[color:var(--brand-soft-strong)]"
                      aria-label={`Quitar ${target.name}`}
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {isTargetOpen && (
            <div className="custom-scrollbar absolute top-full left-0 z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-[var(--radius-md)] border border-line bg-surface p-2 shadow-[var(--shadow-lg)]">
              {targetGroups.map((group) =>
                group.items.length > 0 ? (
                  <fieldset key={group.key} className="mb-2 last:mb-0">
                    <legend className="px-2 py-1 text-[11px] font-bold text-fg-subtle">
                      {group.label}
                    </legend>
                    {group.items.map((item) => {
                      const isSelected = selectedTargets.some(t => t.id === item.id && t.type === group.type)
                      return (
                        <label
                          key={`${group.type}-${item.id}`}
                          className={`mb-1 flex cursor-pointer items-center justify-between gap-2 rounded-[var(--radius-sm)] p-2 text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[color:var(--ring)] ${
                            isSelected ? 'bg-brand-soft text-[color:var(--brand-text)]' : 'text-fg hover:bg-surface-3'
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            {group.icon}
                            <span className="truncate">{item.name}</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleTarget({ id: item.id, name: item.name, type: group.type })}
                            className="sr-only"
                          />
                          {isSelected && <Check size={14} aria-hidden="true" />}
                        </label>
                      )
                    })}
                  </fieldset>
                ) : null
              )}
            </div>
          )}
        </div>

        {/* 2. TIPO DE TAREA */}
        <div className="field">
          <label htmlFor="task-type" className="field-label">Tarea o evento</label>

          <div className="relative">
            {selectedTaskType && (
              <span
                className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${selectedTaskType.color}`}
                aria-hidden="true"
              >
                <selectedTaskType.icon size={18} />
              </span>
            )}
            {!selectedTaskType && (
              <FileText
                className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-fg-muted"
                aria-hidden="true"
              />
            )}
            <select
              id="task-type"
              data-autofocus
              value={selectedTaskType?.id ?? ''}
              onChange={(e) => {
                const found = TASK_TYPES.find(t => t.id === e.target.value) ?? null
                setSelectedTaskType(found)
              }}
              className="field-input pl-10"
            >
              <option value="">Seleccionar tipo...</option>
              {TASK_TYPES.map(type => (
                <option key={type.id} value={type.id}>{type.label}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedTaskType?.id === 'otro' && (
          <div className="field">
            <label htmlFor="task-other" className="field-label">Nombre de la tarea</label>
            <input
              id="task-other"
              type="text"
              placeholder="Especificá la tarea"
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              className="field-input"
            />
          </div>
        )}

        {selectedTaskType?.id === 'fertilizante' && (
          <div className="space-y-4 rounded-[var(--radius-lg)] border border-line bg-surface-2 p-4">
            <div className="field">
              <label htmlFor="task-nutrition" className="field-label">Combo o producto (opcional)</label>
              <div className="relative">
                <select
                  id="task-nutrition"
                  value={selectedNutrition ? `${selectedNutrition.type}-${selectedNutrition.id}` : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) {
                      setSelectedNutrition(null);
                    } else {
                      const [type, id] = val.split('-');
                      setSelectedNutrition({ type: type as 'product' | 'combo', id: parseInt(id) });
                    }
                  }}
                  className="field-input"
                  aria-busy={isNutritionLoading}
                >
                  <option value="">Seleccionar...</option>
                  {combos.length > 0 && <optgroup label="Combos nutricionales">
                    {combos.map(c => <option key={`combo-${c.id}`} value={`combo-${c.id}`}>{c.name}</option>)}
                  </optgroup>}
                  {fertilizers.length > 0 && <optgroup label="Productos individuales">
                    {fertilizers.map(f => <option key={`product-${f.id}`} value={`product-${f.id}`}>{f.name}</option>)}
                  </optgroup>}
                </select>
                {isNutritionLoading && (
                  <Loader2
                    size={16}
                    className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 animate-spin text-fg-muted"
                    aria-hidden="true"
                  />
                )}
              </div>
              <p className="field-hint">Al elegirlo se calcula la receta y se agrega a los detalles.</p>
            </div>

            <div className="field">
              <label htmlFor="task-application" className="field-label">Tipo de aplicación</label>
              <select
                id="task-application"
                value={applicationType}
                onChange={(e) => setApplicationType(e.target.value)}
                className="field-input"
              >
                <option value="Riego">Riego</option>
                <option value="Foliar">Foliar</option>
                <option value="Directo al Sustrato">Directo al sustrato</option>
              </select>
            </div>
          </div>
        )}

        {selectedTaskType?.id === 'cambio_etapa' && (
          <div className="field">
            <label htmlFor="task-stage" className="field-label">Etapa destino</label>
            <select
              id="task-stage"
              value={targetStage}
              onChange={(e) => setTargetStage(e.target.value)}
              className="field-input"
            >
              <option value="Germinación">Germinación</option>
              <option value="Plántula">Plántula</option>
              <option value="Vegetativo">Vegetativo</option>
              <option value="Enraizamiento">Enraizamiento</option>
              <option value="Floración">Floración</option>
              <option value="Secado">Secado</option>
              <option value="Curado">Curado</option>
            </select>
          </div>
        )}

        {selectedTaskType?.id === 'ambiente' && (
          <div className="field">
            <label htmlFor="task-space" className="field-label">Espacio destino</label>
            <select
              id="task-space"
              value={targetSpaceId}
              onChange={(e) => setTargetSpaceId(e.target.value ? Number(e.target.value) : '')}
              className="field-input"
            >
              <option value="">Seleccionar espacio...</option>
              {spaces.map(space => (
                <option key={`target-space-${space.id}`} value={space.id}>{space.name}</option>
              ))}
            </select>

            {targetSpaceId !== '' && selectedTargets.some(t => {
              if (t.type === 'plant') {
                const p = plants.find(plant => plant.id === t.id);
                return p?.space_id === Number(targetSpaceId);
              }
              if (t.type === 'cycle') {
                const c = cycles.find(cycle => cycle.id === t.id);
                return c?.space_id === Number(targetSpaceId);
              }
              return false;
            }) && (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-[color:var(--warning)]" role="status">
                <AlertTriangle size={14} aria-hidden="true" />
                El objetivo ya está en este espacio.
              </p>
            )}
          </div>
        )}

        {/* 3. FECHA */}
        <div className="field">
          <label htmlFor="task-date" className="field-label">Fecha</label>
          <DatePicker id="task-date" selectedDate={date} onChange={setDate} />
        </div>

        <div className="rounded-[var(--radius-md)] border border-line bg-surface-2 p-3">
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span className="text-sm font-semibold text-fg">Repetir</span>
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="peer sr-only"
            />
            {/* Interruptor: el input real queda debajo, así conserva foco y estado */}
            <span
              className="relative h-6 w-11 shrink-0 rounded-full bg-[color:var(--surface-3)] transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-surface after:shadow-[var(--shadow-sm)] after:transition-transform peer-checked:bg-brand peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--ring)]"
              aria-hidden="true"
            />
          </label>

          {isRecurring && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="field">
                <label htmlFor="task-frequency" className="field-label">Frecuencia</label>
                <select
                  id="task-frequency"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="field-input"
                >
                  <option value="daily">Diario</option>
                  <option value="every2days">Cada 2 días</option>
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Quincenal</option>
                  <option value="monthly">Mensual</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="task-end-date" className="field-label">Termina el</label>
                <DatePicker id="task-end-date" selectedDate={endDate} onChange={setEndDate} />
              </div>
            </div>
          )}
        </div>

        {/* 4. DETALLES */}
        <div className="field">
          <label htmlFor="task-description" className="field-label">Detalles</label>
          <textarea
            id="task-description"
            placeholder="Descripción adicional"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="field-input resize-none"
          />
        </div>
      </form>
    </Modal>
  )
}
