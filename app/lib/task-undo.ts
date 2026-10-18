/**
 * DESHACER UNA TAREA COMPLETADA
 * ------------------------------------------------------------------
 * Completar una tarea puede cambiar plantas y ciclos: regarlas, cambiarles la
 * etapa, archivarlas ("muerta") o mudarlas de espacio ("ambiente"). Un toque
 * de más en la agenda alcanzaba para archivar un ciclo entero, y la única
 * forma de volver atrás era planta por planta.
 *
 * Al completar se guarda en `metadata.last_effect` cómo estaba cada cosa
 * antes. "Deshacer" lee eso y lo vuelve a poner. Todo lo de este archivo es
 * puro: la acción de servidor lee y escribe la base.
 */

/** Cuánto tiempo después de completar se puede deshacer. */
export const UNDO_WINDOW_MS = 1000 * 60 * 30;

export interface WaterBefore {
  id: number;
  last_water: string | null;
}

export interface StageBefore {
  id: number;
  stage: string | null;
  stage_updated_at: string | null;
  /** El valor que tenía la columna de fecha de la etapa nueva. */
  date: string | null;
}

export interface LastEffect {
  /** Cuándo se completó la tarea (ISO). */
  at: string;
  water?: WaterBefore[];
  /** Plantas que se archivaron al completar (estaban activas). */
  archived?: number[];
  stage?: { column: string; plants: StageBefore[] };
  /** Ciclos mudados de espacio, con el espacio que tenían. */
  cycles?: { id: number; space_id: number | null }[];
  /** Plantas pasadas de ciclo, con el ciclo que tenían. */
  plants?: { id: number; cycle_id: number | null }[];
}

function isId(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function nullableId(value: unknown): number | null | undefined {
  if (value === null) return null;
  return isId(value) ? value : undefined;
}

function nullableText(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === 'string' ? value : undefined;
}

/**
 * Lee `metadata.last_effect`. Descarta lo que no tenga la forma esperada:
 * la metadata es jsonb y no conviene confiar en ella a ciegas.
 */
export function readLastEffect(metadata: unknown): LastEffect | null {
  const raw = (metadata as { last_effect?: unknown } | null)?.last_effect as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== 'object' || typeof raw.at !== 'string') return null;

  const effect: LastEffect = { at: raw.at };

  if (Array.isArray(raw.water)) {
    effect.water = raw.water.flatMap((item) => {
      const id = (item as WaterBefore)?.id;
      const lastWater = nullableText((item as WaterBefore)?.last_water);
      return isId(id) && lastWater !== undefined ? [{ id, last_water: lastWater }] : [];
    });
  }

  if (Array.isArray(raw.archived)) effect.archived = raw.archived.filter(isId);

  const stage = raw.stage as { column?: unknown; plants?: unknown } | undefined;
  if (stage && typeof stage.column === 'string' && Array.isArray(stage.plants)) {
    effect.stage = {
      column: stage.column,
      plants: stage.plants.flatMap((item) => {
        const row = item as StageBefore;
        const fields = [nullableText(row?.stage), nullableText(row?.stage_updated_at), nullableText(row?.date)];
        if (!isId(row?.id) || fields.some((value) => value === undefined)) return [];
        return [{ id: row.id, stage: fields[0] ?? null, stage_updated_at: fields[1] ?? null, date: fields[2] ?? null }];
      }),
    };
  }

  if (Array.isArray(raw.cycles)) {
    effect.cycles = raw.cycles.flatMap((item) => {
      const id = (item as { id?: unknown })?.id;
      const spaceId = nullableId((item as { space_id?: unknown })?.space_id);
      return isId(id) && spaceId !== undefined ? [{ id, space_id: spaceId }] : [];
    });
  }

  if (Array.isArray(raw.plants)) {
    effect.plants = raw.plants.flatMap((item) => {
      const id = (item as { id?: unknown })?.id;
      const cycleId = nullableId((item as { cycle_id?: unknown })?.cycle_id);
      return isId(id) && cycleId !== undefined ? [{ id, cycle_id: cycleId }] : [];
    });
  }

  return effect;
}

/** ¿Hay algo que deshacer? */
export function hasUndoableChanges(effect: LastEffect | null): boolean {
  if (!effect) return false;
  return Boolean(
    effect.water?.length ||
      effect.archived?.length ||
      effect.stage?.plants.length ||
      effect.cycles?.length ||
      effect.plants?.length
  );
}

/** ¿Todavía se puede deshacer? Pasada la ventana, otras cosas pudieron cambiar. */
export function canStillUndo(effect: LastEffect | null, now: Date = new Date()): boolean {
  if (!effect) return false;
  const at = new Date(effect.at).getTime();
  if (isNaN(at)) return false;
  return now.getTime() - at <= UNDO_WINDOW_MS;
}

/**
 * Agrupa ids por el valor a restaurar: una consulta por valor distinto en vez
 * de una por planta (regar un ciclo entero deja casi siempre uno o dos).
 */
export function groupByValue<T>(items: { id: number; value: T }[]): { value: T; ids: number[] }[] {
  const groups = new Map<string, { value: T; ids: number[] }>();
  for (const item of items) {
    const key = JSON.stringify(item.value ?? null);
    const group = groups.get(key);
    if (group) group.ids.push(item.id);
    else groups.set(key, { value: item.value, ids: [item.id] });
  }
  return Array.from(groups.values());
}
