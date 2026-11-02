import { Bean, Droplets, GitBranch, Lamp, Shovel, SprayCan, Sun, SunMoon } from 'lucide-react'
import { ACCENTS, TASK_TYPES } from '@/app/lib/constants'
import { getStageColor } from '@/app/lib/utils'
import type { ChoiceOption } from './Choice'

/**
 * Las listas de opciones que se repetían en cada formulario, escritas una vez
 * con su icono y su color de taxonomía.
 */

/** Etapas como chips con el color y el icono de cada una. */
export function stageOptions<T extends string>(names: readonly T[]): ChoiceOption<T>[] {
  return names.map((name) => {
    const style = getStageColor(name)
    return { value: name, label: name, icon: style.icon, accent: style.accent }
  })
}

/** Los tipos de tarea, con el icono y el acento con que se ven en la agenda. */
export function taskTypeOptions(): ChoiceOption<string>[] {
  return TASK_TYPES.map((type) => ({
    value: type.id,
    label: type.label,
    icon: <type.icon size={22} strokeWidth={1.9} />,
    accent: ACCENTS[type.accent].raw,
  }))
}

export const SPACE_TYPE_OPTIONS: ChoiceOption<'Indoor' | 'Outdoor' | 'Mixto'>[] = [
  { value: 'Indoor', label: 'Indoor', icon: <Lamp size={20} />, description: 'Carpa o armario con luz artificial' },
  { value: 'Outdoor', label: 'Outdoor', icon: <Sun size={20} />, description: 'Patio, balcón o terraza, con sol' },
  { value: 'Mixto', label: 'Mixto', icon: <SunMoon size={20} />, description: 'Empieza adentro y termina afuera' },
]

export const SOURCE_OPTIONS: ChoiceOption<'Semilla' | 'Esqueje'>[] = [
  { value: 'Semilla', label: 'Semilla', icon: <Bean size={20} />, description: 'Arranca en germinación' },
  { value: 'Esqueje', label: 'Esqueje', icon: <GitBranch size={20} />, description: 'Arranca en enraizamiento' },
]

export const APPLICATION_OPTIONS: ChoiceOption<string>[] = [
  { value: 'Riego', label: 'En el riego', icon: <Droplets size={17} /> },
  { value: 'Foliar', label: 'Foliar', icon: <SprayCan size={17} /> },
  { value: 'Directo al Sustrato', label: 'Al sustrato', icon: <Shovel size={17} /> },
]
