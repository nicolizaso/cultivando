/**
 * NUTRICIÓN
 * ------------------------------------------------------------------
 * Dosis de cada producto según la semana de la etapa y la receta que se
 * escribe en la tarea de fertilizante. Todo puro: la Server Action y el
 * modal usan las mismas cuentas.
 *
 * Los nombres siguen las columnas reales de `fertilizers`
 * (`dosage_type`, `fixed_dosage`, `weekly_dosages`, `stage_category`).
 * Antes el código leía otros nombres (`dose_type`, `dose_fixed`…) que no
 * existían, y por eso la página decía "Tabla por semanas" para productos de
 * dosis fija y la receta salía vacía.
 */

export const FERTILIZER_STAGES = ['enraizamiento', 'vegetativo', 'floracion', 'lavado', 'todo'] as const;
export type FertilizerStage = (typeof FERTILIZER_STAGES)[number];

export const DOSAGE_TYPES = ['fija', 'semanal'] as const;
export type DosageType = (typeof DOSAGE_TYPES)[number];

export const FERTILIZER_STAGE_LABELS: Record<FertilizerStage, string> = {
  todo: 'Todo el ciclo',
  enraizamiento: 'Enraizamiento',
  vegetativo: 'Vegetativo',
  floracion: 'Floración',
  lavado: 'Lavado de raíces',
};

// `type` y no `interface`: así se puede guardar tal cual en una columna jsonb.
export type WeeklyDose = {
  week: number;
  dose: number;
};

export interface FertilizerDoseInfo {
  id: number;
  name: string;
  dosage_type: string | null;
  fixed_dosage: number | null;
  weekly_dosages: unknown;
}

/** Tope de semanas de una tabla: un ciclo largo de floración no pasa de esto. */
export const MAX_WEEKS = 30;

/**
 * La tabla semanal tal como debería estar: semanas enteras entre 1 y 30, sin
 * repetidas, dosis no negativas, ordenada. Lo que no se entiende se descarta.
 */
export function parseWeeklyDosages(value: unknown): WeeklyDose[] {
  if (!Array.isArray(value)) return [];
  const byWeek = new Map<number, number>();
  for (const item of value) {
    const week = Number((item as WeeklyDose)?.week);
    const dose = Number(String((item as WeeklyDose)?.dose ?? '').replace(',', '.'));
    if (!Number.isInteger(week) || week < 1 || week > MAX_WEEKS) continue;
    if (!Number.isFinite(dose) || dose < 0 || dose > 1000) continue;
    byWeek.set(week, dose);
  }
  return Array.from(byWeek, ([week, dose]) => ({ week, dose })).sort((a, b) => a.week - b.week);
}

/** Semana de la etapa (1, 2, 3…) a partir de los días que lleva en ella. */
export function weekInStage(daysInStage: number | null | undefined): number {
  const days = Math.max(0, Math.floor(Number(daysInStage) || 0));
  return Math.floor(days / 7) + 1;
}

/**
 * Dosis en ml/L de un producto para una semana. Con tabla semanal vale la
 * última fila cuya semana no supera la pedida (si la tabla dice semana 1 y
 * semana 4, la semana 3 sigue con la dosis de la 1); antes de la primera fila
 * se usa la primera. Devuelve null si el producto no tiene dosis cargada.
 */
export function doseForWeek(fertilizer: FertilizerDoseInfo, week: number): number | null {
  if (fertilizer.dosage_type !== 'semanal') {
    const fixed = Number(fertilizer.fixed_dosage);
    return fertilizer.fixed_dosage === null || !Number.isFinite(fixed) ? null : fixed;
  }

  const table = parseWeeklyDosages(fertilizer.weekly_dosages);
  if (table.length === 0) return null;

  let chosen = table[0];
  for (const row of table) {
    if (row.week <= week) chosen = row;
  }
  return chosen.dose;
}

/** 2 → "2", 1.5 → "1,5", 0.333 → "0,33". */
export function formatDose(dose: number): string {
  return (Math.round(dose * 100) / 100).toLocaleString('es-AR', { maximumFractionDigits: 2 });
}

export interface RecipeItem {
  fertilizerId: number;
  name: string;
  /** ml por litro de agua, o null si el producto no tiene dosis cargada. */
  dose: number | null;
}

/** Lo que se eligió en el modal: un producto suelto o un combo. */
export type NutritionSelection = { type: 'product' | 'combo'; id: number };

export interface ComboInfo {
  id: number;
  products: { fertilizer_id: number; name: string }[];
}

/** Los productos (con su dosis de esa semana) que lleva la selección. */
export function recipeItems(
  selection: NutritionSelection,
  fertilizers: FertilizerDoseInfo[],
  combos: ComboInfo[],
  week: number
): RecipeItem[] {
  const byId = new Map(fertilizers.map((fertilizer) => [Number(fertilizer.id), fertilizer]));

  const ids =
    selection.type === 'product'
      ? [selection.id]
      : (combos.find((combo) => Number(combo.id) === Number(selection.id))?.products ?? []).map((p) => p.fertilizer_id);

  const comboNames = new Map(
    (combos.find((combo) => Number(combo.id) === Number(selection.id))?.products ?? []).map((p) => [Number(p.fertilizer_id), p.name])
  );

  return ids.map((rawId) => {
    const id = Number(rawId);
    const fertilizer = byId.get(id);
    return {
      fertilizerId: id,
      name: fertilizer?.name ?? comboNames.get(id) ?? 'Producto',
      dose: fertilizer ? doseForWeek(fertilizer, week) : null,
    };
  });
}

export const RECIPE_PREFIX = 'Preparar:';

/** "Preparar: Grow A: 2 ml/L + Bloom B: 1,5 ml/L (semana 3)". */
export function buildRecipe(items: RecipeItem[], week: number): string {
  if (items.length === 0) return '';
  const parts = items.map((item) => `${item.name}: ${item.dose === null ? '?' : formatDose(item.dose)} ml/L`);
  return `${RECIPE_PREFIX} ${parts.join(' + ')} (semana ${week})`;
}

/**
 * Pone la receta en la descripción de la tarea: reemplaza la línea "Preparar:"
 * si ya había una y, si no, la agrega arriba sin tocar el resto del texto.
 */
export function withRecipe(description: string | null | undefined, recipe: string): string {
  const text = description ?? '';
  if (!recipe) return text;
  const lines = text.split('\n');
  const index = lines.findIndex((line) => line.startsWith(RECIPE_PREFIX));
  if (index !== -1) {
    lines[index] = recipe;
    return lines.join('\n');
  }
  return text.trim() ? `${recipe}\n\n${text}` : recipe;
}

/** Promedio de días en etapa de un grupo de plantas (para un ciclo entero). */
export function averageDays(days: (number | null | undefined)[]): number | null {
  const valid = days
    .filter((value): value is number => value !== null && value !== undefined)
    .map(Number)
    .filter((value) => Number.isFinite(value) && value >= 0);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}
