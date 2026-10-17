/**
 * AVISOS DEL DÍA
 * ------------------------------------------------------------------
 * Arma la notificación diaria de cada usuario: tareas de hoy, atrasadas,
 * VPD fuera de rango y stock bajo, según lo que eligió recibir. Una sola
 * notificación por día y por dispositivo, corta: el detalle está en la app.
 * Puro.
 */

export interface NotificationPrefs {
  tasks: boolean;
  overdue: boolean;
  climate: boolean;
  stock: boolean;
}

export const DEFAULT_PREFS: NotificationPrefs = { tasks: true, overdue: true, climate: true, stock: true };

export const PREF_LABELS: Record<keyof NotificationPrefs, string> = {
  tasks: 'Tareas del día',
  overdue: 'Tareas atrasadas',
  climate: 'VPD fuera de rango',
  stock: 'Stock bajo de fertilizantes',
};

export function readPrefs(value: unknown): NotificationPrefs {
  const raw = (value ?? {}) as Partial<Record<keyof NotificationPrefs, unknown>>;
  return {
    tasks: raw.tasks !== false,
    overdue: raw.overdue !== false,
    climate: raw.climate !== false,
    stock: raw.stock !== false,
  };
}

export interface DigestInput {
  todayTasks: { title: string }[];
  overdue: number;
  climateAlerts: { cycle: string; level: 'low' | 'high'; vpd: number }[];
  lowStock: { name: string }[];
  prefs: NotificationPrefs;
}

export interface Digest {
  title: string;
  body: string;
  /** A dónde lleva tocar la notificación. */
  url: string;
  /** Una notificación nueva del mismo día reemplaza a la anterior. */
  tag: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function list(items: string[], max = 3): string {
  if (items.length <= max) return items.join(', ');
  return `${items.slice(0, max).join(', ')} y ${items.length - max} más`;
}

/** null si no hay nada que avisar (no se manda nada). */
export function buildDigest(input: DigestInput, today: string): Digest | null {
  const { prefs } = input;
  const parts: string[] = [];
  let url = '/';

  const tasks = prefs.tasks ? input.todayTasks : [];
  if (tasks.length > 0) parts.push(`${list(tasks.map((task) => task.title))}`);
  if (prefs.overdue && input.overdue > 0) parts.push(`${plural(input.overdue, 'atrasada', 'atrasadas')}`);
  if (prefs.climate && input.climateAlerts.length > 0) {
    parts.push(
      input.climateAlerts
        .map((alert) => `VPD ${alert.level === 'high' ? 'alto' : 'bajo'} en ${alert.cycle} (${alert.vpd.toLocaleString('es-AR', { maximumFractionDigits: 2 })} kPa)`)
        .join(', ')
    );
  }
  if (prefs.stock && input.lowStock.length > 0) {
    parts.push(`queda poco ${list(input.lowStock.map((item) => item.name), 2)}`);
    if (parts.length === 1) url = '/fertilizers';
  }

  if (parts.length === 0) return null;

  const title = tasks.length > 0
    ? `Hoy: ${plural(tasks.length, 'tarea', 'tareas')}`
    : prefs.overdue && input.overdue > 0
      ? `${plural(input.overdue, 'tarea atrasada', 'tareas atrasadas')}`
      : 'Cultivando';

  const body = parts.join(' · ');
  return {
    title,
    body: body.length > 180 ? `${body.slice(0, 177)}…` : body,
    url,
    tag: `resumen-${today}`,
  };
}
