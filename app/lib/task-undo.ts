/**
 * DESHACER UNA TAREA COMPLETADA
 * ------------------------------------------------------------------
 * Completar una tarea puede cambiar plantas y ciclos: regarlas, cambiarles la
 * etapa, archivarlas ("muerta") o mudarlas de espacio ("ambiente"). Un toque
 * de más en la agenda alcanzaba para archivar un ciclo entero, y la única
 * forma de volver atrás era planta por planta.
 *
 * Al completar se guarda en `metadata.last_effect` cómo estaba cada cosa
 * antes y qué escribió la tarea. Desmarcarla (o "Deshacer") lo vuelve a poner,
 * pero sólo donde sigue lo que escribió la tarea: si después se cambió a mano,
 * eso no se pisa. Por eso ya no hay una ventana de 30 minutos. Todo lo de este
 * archivo es puro: la acción de servidor lee y escribe la base.
 */

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
  /** El día que la tarea escribió en `last_water`. */
  waterSet?: string;
  /** Plantas que se archivaron al completar (estaban activas). */
  archived?: number[];
  stage?: {
    column: string;
    plants: StageBefore[];
    /** Lo que escribió la tarea: la etapa y `stage_updated_at`. */
    set?: { stage: string; at: string };
  };
  /** Ciclos mudados de espacio, con el espacio que tenían y al que fueron. */
  cycles?: { id: number; space_id: number | null; to?: number }[];
  /** Plantas pasadas de ciclo, con el ciclo que tenían y al que fueron. */
  plants?: { id: number; cycle_id: number | null; to?: number | null }[];
  /** Un ciclo que creó la tarea en el destino de una mudanza. */
  createdCycle?: number;
  /** Plantas a las que la tarea les creó la ficha de cosecha. */
  harvests?: number[];
  /** Registros de bitácora que escribió la tarea (una mezcla aplicada). */
  logs?: number[];
  /** Lo que se descontó del stock: [{ fertilizer_id, delta }], con delta negativo. */
  stock?: { fertilizer_id: number; delta: number }[];
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

  if (typeof raw.waterSet === 'string') effect.waterSet = raw.waterSet;

  if (Array.isArray(raw.archived)) effect.archived = raw.archived.filter(isId);

  const stage = raw.stage as { column?: unknown; plants?: unknown; set?: { stage?: unknown; at?: unknown } } | undefined;
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
    if (typeof stage.set?.stage === 'string' && typeof stage.set?.at === 'string') {
      effect.stage.set = { stage: stage.set.stage, at: stage.set.at };
    }
  }

  if (Array.isArray(raw.cycles)) {
    effect.cycles = raw.cycles.flatMap((item) => {
      const id = (item as { id?: unknown })?.id;
      const spaceId = nullableId((item as { space_id?: unknown })?.space_id);
      const to = (item as { to?: unknown })?.to;
      if (!isId(id) || spaceId === undefined) return [];
      return [isId(to) ? { id, space_id: spaceId, to } : { id, space_id: spaceId }];
    });
  }

  if (Array.isArray(raw.plants)) {
    effect.plants = raw.plants.flatMap((item) => {
      const id = (item as { id?: unknown })?.id;
      const cycleId = nullableId((item as { cycle_id?: unknown })?.cycle_id);
      const to = nullableId((item as { to?: unknown })?.to);
      if (!isId(id) || cycleId === undefined) return [];
      return [to !== undefined ? { id, cycle_id: cycleId, to } : { id, cycle_id: cycleId }];
    });
  }

  if (isId(raw.createdCycle)) effect.createdCycle = raw.createdCycle;
  if (Array.isArray(raw.harvests)) effect.harvests = raw.harvests.filter(isId);

  if (Array.isArray(raw.logs)) effect.logs = raw.logs.filter(isId);

  if (Array.isArray(raw.stock)) {
    effect.stock = raw.stock.flatMap((item) => {
      const id = (item as { fertilizer_id?: unknown })?.fertilizer_id;
      const delta = Number((item as { delta?: unknown })?.delta);
      return isId(id) && Number.isFinite(delta) && delta !== 0 ? [{ fertilizer_id: id, delta }] : [];
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
      effect.plants?.length ||
      effect.logs?.length ||
      effect.stock?.length ||
      effect.harvests?.length ||
      effect.createdCycle
  );
}

/**
 * Lo guardado antes de que `last_effect` anotara lo que escribió la tarea
 * (sin `waterSet`, `stage.set` ni `to`) no se puede comparar con lo que hay
 * hoy. Eso se revierte como antes, sólo en los primeros 30 minutos: después
 * pudo haber cambios a mano que no hay que pisar.
 */
export function canRevertUnmarked(effect: { at: string }, now: Date = new Date()): boolean {
  const at = new Date(effect.at).getTime();
  return !isNaN(at) && now.getTime() - at <= 1000 * 60 * 30;
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
