import {
  Droplets, FlaskConical, ShieldAlert, Shovel, Scissors, Activity,
  ArrowRightLeft, ArrowRightCircle, CloudRain, Flower, Skull, PenTool,
  Calendar, Camera, Sprout, GitBranch, LucideIcon
} from 'lucide-react';
import React from 'react';

/**
 * TAXONOMÍA DE COLOR
 * ------------------------------------------------------------------
 * Toda la app pinta etapas y tipos de tarea desde estos nueve acentos.
 * Antes cada archivo repetía su propia terna de clases con colores fijos de
 * Tailwind, y las tres copias se habían ido separando entre sí. Ahora el color
 * vive en tokens (globals.css) y acá sólo se declara qué acento le toca a cada
 * concepto.
 *
 * Las clases se escriben literales: Tailwind escanea texto y no resuelve
 * nombres construidos por interpolación.
 */
export type AccentName =
  | 'amber' | 'lime' | 'green' | 'teal' | 'cyan'
  | 'blue' | 'violet' | 'rose' | 'slate';

export interface AccentClasses {
  /** Color de texto/icono, ≥4.5:1 sobre la superficie en ambos temas. */
  text: string;
  /** Fondo tenue del mismo tono. */
  bg: string;
  /** Borde a juego, para chips y tarjetas. */
  border: string;
  /** El valor crudo, para estilos en línea (gradientes, SVG). */
  raw: string;
}

export const ACCENTS: Record<AccentName, AccentClasses> = {
  amber: {
    text: 'text-[color:var(--accent-amber)]',
    bg: 'bg-[color:var(--accent-amber-soft)]',
    border: 'border-[color:color-mix(in_srgb,var(--accent-amber)_32%,transparent)]',
    raw: 'var(--accent-amber)',
  },
  lime: {
    text: 'text-[color:var(--accent-lime)]',
    bg: 'bg-[color:var(--accent-lime-soft)]',
    border: 'border-[color:color-mix(in_srgb,var(--accent-lime)_32%,transparent)]',
    raw: 'var(--accent-lime)',
  },
  green: {
    text: 'text-[color:var(--accent-green)]',
    bg: 'bg-[color:var(--accent-green-soft)]',
    border: 'border-[color:color-mix(in_srgb,var(--accent-green)_32%,transparent)]',
    raw: 'var(--accent-green)',
  },
  teal: {
    text: 'text-[color:var(--accent-teal)]',
    bg: 'bg-[color:var(--accent-teal-soft)]',
    border: 'border-[color:color-mix(in_srgb,var(--accent-teal)_32%,transparent)]',
    raw: 'var(--accent-teal)',
  },
  cyan: {
    text: 'text-[color:var(--accent-cyan)]',
    bg: 'bg-[color:var(--accent-cyan-soft)]',
    border: 'border-[color:color-mix(in_srgb,var(--accent-cyan)_32%,transparent)]',
    raw: 'var(--accent-cyan)',
  },
  blue: {
    text: 'text-[color:var(--accent-blue)]',
    bg: 'bg-[color:var(--accent-blue-soft)]',
    border: 'border-[color:color-mix(in_srgb,var(--accent-blue)_32%,transparent)]',
    raw: 'var(--accent-blue)',
  },
  violet: {
    text: 'text-[color:var(--accent-violet)]',
    bg: 'bg-[color:var(--accent-violet-soft)]',
    border: 'border-[color:color-mix(in_srgb,var(--accent-violet)_32%,transparent)]',
    raw: 'var(--accent-violet)',
  },
  rose: {
    text: 'text-[color:var(--accent-rose)]',
    bg: 'bg-[color:var(--accent-rose-soft)]',
    border: 'border-[color:color-mix(in_srgb,var(--accent-rose)_32%,transparent)]',
    raw: 'var(--accent-rose)',
  },
  slate: {
    text: 'text-[color:var(--accent-slate)]',
    bg: 'bg-[color:var(--accent-slate-soft)]',
    border: 'border-[color:color-mix(in_srgb,var(--accent-slate)_32%,transparent)]',
    raw: 'var(--accent-slate)',
  },
};

export interface TaskTypeDef {
  id: string;
  label: string;
  icon: LucideIcon;
  accent: AccentName;
  /** Alias heredados: mismos valores que ACCENTS[accent]. */
  color: string;
  bg: string;
  border: string;
}

function defineTask(id: string, label: string, icon: LucideIcon, accent: AccentName): TaskTypeDef {
  const a = ACCENTS[accent];
  return { id, label, icon, accent, color: a.text, bg: a.bg, border: a.border };
}

/**
 * Los acentos se reparten para que dos tareas que suelen convivir en el mismo
 * día no compartan tono: riego y lavado son ambos agua, pero uno es cian y el
 * otro azul; poda y "otro" caen en el gris neutro porque no necesitan destacar.
 */
export const TASK_TYPES: TaskTypeDef[] = [
  defineTask('riego', 'Riego', Droplets, 'cyan'),
  defineTask('fertilizante', 'Fertilizante', FlaskConical, 'green'),
  defineTask('repelente', 'Repelente', ShieldAlert, 'amber'),
  defineTask('trasplante', 'Trasplante', Shovel, 'lime'),
  defineTask('esquejado', 'Esquejado', GitBranch, 'lime'),
  defineTask('poda', 'Poda', Scissors, 'slate'),
  defineTask('entrenamiento', 'Entrenamiento', Activity, 'teal'),
  defineTask('ambiente', 'Cambiar ambiente', ArrowRightLeft, 'blue'),
  defineTask('cambio_etapa', 'Cambio de etapa', ArrowRightCircle, 'violet'),
  defineTask('lavado', 'Lavado de raíces', CloudRain, 'blue'),
  defineTask('cosechar', 'Cosechar', Flower, 'violet'),
  defineTask('muerta', 'Declarar muerta', Skull, 'rose'),
  defineTask('otro', 'Otro', PenTool, 'slate'),
];

const FALLBACK_TYPES: Record<string, TaskTypeDef> = {
  foto: defineTask('foto', 'Foto', Camera, 'amber'),
  image: defineTask('image', 'Foto', Camera, 'amber'),
  log: defineTask('log', 'Registro', Sprout, 'lime'),
};

const UNKNOWN_TYPE = defineTask('desconocido', 'Evento', Calendar, 'slate');

/**
 * Punto único de entrada: dado el `type` que guarda la base (que a veces trae
 * mayúsculas, acentos o valores heredados), devuelve su definición.
 */
export function getTaskType(type?: string): TaskTypeDef {
  const key = type?.toLowerCase().trim() ?? '';
  return (
    TASK_TYPES.find(t => t.id === key) ??
    FALLBACK_TYPES[key] ??
    TASK_TYPES.find(t => key.includes(t.id)) ??
    UNKNOWN_TYPE
  );
}

export function getTaskIcon(type: string, size = 16) {
  const Icon = getTaskType(type).icon;
  return <Icon size={size} aria-hidden="true" />;
}
