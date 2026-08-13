import {
  Droplets, FlaskConical, ShieldAlert, Shovel, Scissors, Activity,
  ArrowRightLeft, ArrowRightCircle, CloudRain, Flower, Skull, PenTool,
  Calendar, Sprout
} from 'lucide-react';
import React from 'react';

/**
 * Cada tipo de tarea lleva su terna de clases (texto, fondo, borde) resuelta
 * para tema claro y oscuro. Antes usaban valores fijos como `bg-black` o
 * `text-slate-800`, ilegibles en uno de los dos temas.
 */
export const TASK_TYPES = [
  { id: 'riego', label: 'Riego', icon: Droplets, color: 'text-sky-700 dark:text-sky-300', border: 'border-sky-500/30', bg: 'bg-sky-500/10' },
  { id: 'fertilizante', label: 'Fertilizante', icon: FlaskConical, color: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
  { id: 'repelente', label: 'Repelente', icon: ShieldAlert, color: 'text-orange-700 dark:text-orange-300', border: 'border-orange-500/30', bg: 'bg-orange-500/10' },
  { id: 'trasplante', label: 'Trasplante', icon: Shovel, color: 'text-amber-700 dark:text-amber-300', border: 'border-amber-600/30', bg: 'bg-amber-600/10' },
  { id: 'poda', label: 'Poda', icon: Scissors, color: 'text-slate-700 dark:text-slate-300', border: 'border-slate-500/30', bg: 'bg-slate-500/10' },
  { id: 'entrenamiento', label: 'Entrenamiento', icon: Activity, color: 'text-teal-700 dark:text-teal-300', border: 'border-teal-500/30', bg: 'bg-teal-500/10' },
  { id: 'ambiente', label: 'Cambiar ambiente', icon: ArrowRightLeft, color: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-500/30', bg: 'bg-indigo-500/10' },
  { id: 'cambio_etapa', label: 'Cambio de etapa', icon: ArrowRightCircle, color: 'text-purple-700 dark:text-purple-300', border: 'border-purple-500/30', bg: 'bg-purple-500/10' },
  { id: 'lavado', label: 'Lavado de raíces', icon: CloudRain, color: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10' },
  { id: 'cosechar', label: 'Cosechar', icon: Flower, color: 'text-violet-700 dark:text-violet-300', border: 'border-violet-500/30', bg: 'bg-violet-500/10' },
  { id: 'muerta', label: 'Declarar muerta', icon: Skull, color: 'text-rose-700 dark:text-rose-300', border: 'border-rose-500/30', bg: 'bg-rose-500/10' },
  { id: 'otro', label: 'Otro', icon: PenTool, color: 'text-stone-700 dark:text-stone-300', border: 'border-stone-500/30', bg: 'bg-stone-500/10' },
];

export function getTaskIcon(type: string) {
  const normalizedType = type?.toLowerCase();
  const taskType = TASK_TYPES.find(t => t.id === normalizedType);

  if (taskType) {
    return <taskType.icon size={16} aria-hidden="true" />;
  }

  // Fallbacks
  if (normalizedType === 'log') return <Sprout size={16} aria-hidden="true" />;
  if (normalizedType === 'image') return <Sprout size={16} aria-hidden="true" />;

  return <Calendar size={16} aria-hidden="true" />;
}
