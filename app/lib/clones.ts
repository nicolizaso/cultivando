/**
 * ESQUEJADO
 * ------------------------------------------------------------------
 * Un esqueje es una planta nueva que arranca el día que se corta: día 0 en
 * Enraizamiento, colgando de su madre. La tarea "Esquejado" se agenda sobre un
 * ciclo entero, pero recién al completarla se sabe de qué plantas salieron y
 * cuántos de cada una, así que ese reparto llega desde el cliente y hay que
 * depurarlo antes de escribir nada.
 *
 * Todo lo de este archivo es puro: la acción de servidor pone la base y acá se
 * arman y validan las filas.
 */

/** Etapa en la que nace todo esqueje. */
export const CLONE_STAGE = 'Enraizamiento';

/** Topes de cordura: protegen de un stepper trabado o de un payload armado a mano. */
export const MAX_CLONES_PER_MOTHER = 100;
export const MAX_CLONES_PER_TASK = 300;

/** Cuántos esquejes salieron de cada madre. */
export interface CloneEntry {
  motherId: number;
  count: number;
}

/** Los datos de la madre que hereda el esqueje, más su numeración previa. */
export interface CloneMother {
  id: number;
  name: string;
  strain?: string | null;
  breeder?: string | null;
  /** Esquejes que esa madre ya tiene, para seguir numerando desde ahí. */
  existingClones?: number;
}

/** Una fila lista para insertar en `plants`. */
export interface CloneSeed {
  name: string;
  strain: string | null;
  breeder: string | null;
  source_type: 'Esqueje';
  mother_id: number;
  cycle_id: number;
  stage: typeof CLONE_STAGE;
  planted_at: string;
  date_enraizamiento: string;
  stage_updated_at: string;
  last_water: string;
}

/**
 * Mediodía local: las fechas viajan como YYYY-MM-DD y guardarlas a las 00:00
 * las corre al día anterior en cualquier huso al oeste de UTC.
 */
export function toIsoNoon(date: string): string {
  return date.includes('T') ? date : `${date}T12:00:00`;
}

export function buildCloneName(motherName: string, index: number): string {
  const base = motherName?.trim() || 'Planta';
  return `${base} · Esqueje ${index}`;
}

/**
 * Deja sólo filas usables: madres que estén entre las candidatas de la tarea,
 * cantidades enteras y positivas, y una sola fila por madre.
 */
export function sanitizeCloneEntries(raw: unknown, allowedIds: Iterable<number>): CloneEntry[] {
  if (!Array.isArray(raw)) return [];

  const allowed = new Set(Array.from(allowedIds, (id) => Number(id)));
  const byMother = new Map<number, number>();

  for (const item of raw) {
    const motherId = Number((item as CloneEntry)?.motherId);
    const count = Math.floor(Number((item as CloneEntry)?.count));

    if (!Number.isInteger(motherId) || !allowed.has(motherId)) continue;
    if (!Number.isFinite(count) || count <= 0) continue;

    byMother.set(motherId, (byMother.get(motherId) ?? 0) + count);
  }

  return Array.from(byMother, ([motherId, count]) => ({ motherId, count }));
}

export function totalClones(entries: CloneEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.count, 0);
}

/** `null` si se puede guardar; si no, el motivo en palabras. */
export function validateCloneEntries(entries: CloneEntry[]): string | null {
  const excessive = entries.find((entry) => entry.count > MAX_CLONES_PER_MOTHER);
  if (excessive) {
    return `Son demasiados esquejes de una misma planta (máximo ${MAX_CLONES_PER_MOTHER}).`;
  }

  if (totalClones(entries) > MAX_CLONES_PER_TASK) {
    return `Son demasiados esquejes para una sola tarea (máximo ${MAX_CLONES_PER_TASK}).`;
  }

  return null;
}

/**
 * Arma las plantas a crear. El esqueje hereda genética, banco y madre, y nace
 * el día del corte: `planted_at` y `date_enraizamiento` son la misma fecha, que
 * es lo que hace que la ficha muestre "día 0" y no la edad de la madre.
 */
export function buildClonePlants(
  entries: CloneEntry[],
  mothers: CloneMother[],
  options: { cycleId: number; date: string }
): CloneSeed[] {
  const byId = new Map(mothers.map((mother) => [Number(mother.id), mother]));
  const timestamp = toIsoNoon(options.date);
  const seeds: CloneSeed[] = [];

  for (const entry of entries) {
    const mother = byId.get(Number(entry.motherId));
    if (!mother) continue;

    const alreadyTaken = Math.max(0, Math.floor(Number(mother.existingClones ?? 0)));

    for (let i = 1; i <= entry.count; i++) {
      seeds.push({
        name: buildCloneName(mother.name, alreadyTaken + i),
        strain: mother.strain ?? null,
        breeder: mother.breeder ?? null,
        source_type: 'Esqueje',
        mother_id: Number(mother.id),
        cycle_id: options.cycleId,
        stage: CLONE_STAGE,
        planted_at: timestamp,
        date_enraizamiento: timestamp,
        stage_updated_at: timestamp,
        last_water: 'Nunca',
      });
    }
  }

  return seeds;
}

/** Resumen en palabras para el toast y el resumen del modal. */
export function describeCloneBatch(entries: CloneEntry[]): string {
  const total = totalClones(entries);
  const mothers = entries.length;

  if (total === 0) return 'Sin esquejes';

  const clonesLabel = total === 1 ? '1 esqueje' : `${total} esquejes`;
  const mothersLabel = mothers === 1 ? '1 madre' : `${mothers} madres`;

  return `${clonesLabel} de ${mothersLabel}`;
}
