/**
 * NUTRICIÓN
 * ------------------------------------------------------------------
 * Productos, combos y la mezcla que lleva cada riego o tarea de fertilizante.
 * Todo puro: las Server Actions, los modales y las pruebas usan las mismas
 * cuentas.
 *
 * La mezcla se guarda como datos (qué productos, con qué dosis, en qué semana
 * de la etapa) y la línea "Preparar: …" de los detalles se arma a partir de
 * eso. Antes era al revés: la tarea guardaba sólo el texto, y por eso no se
 * podía editar, una serie copiaba la dosis de una semana a todas y no se
 * podía elegir más de un producto.
 *
 * Los nombres siguen las columnas reales de `fertilizers`
 * (`dosage_type`, `fixed_dosage`, `weekly_dosages`, `stage_category`, `unit`,
 * `dose_basis`).
 */

import { dateKey } from './dates.ts';
import { parseDecimal } from './sanitize.ts';

export const FERTILIZER_STAGES = ['enraizamiento', 'vegetativo', 'floracion', 'lavado', 'todo'] as const;
export type FertilizerStage = (typeof FERTILIZER_STAGES)[number];

export const DOSAGE_TYPES = ['fija', 'semanal'] as const;
export type DosageType = (typeof DOSAGE_TYPES)[number];

/** En qué se mide el producto (y su stock). */
export const DOSE_UNITS = ['ml', 'g'] as const;
export type DoseUnit = (typeof DOSE_UNITS)[number];

/** Sobre qué se dosifica: cada litro de agua o cada planta (enmiendas sólidas). */
export const DOSE_BASES = ['litro', 'planta'] as const;
export type DoseBasis = (typeof DOSE_BASES)[number];

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
  unit?: string | null;
  dose_basis?: string | null;
  stage_category?: string | null;
}

/** Tope de semanas de una tabla: un ciclo largo de floración no pasa de esto. */
export const MAX_WEEKS = 30;

/** Tope de productos en una mezcla. */
export const MAX_MIX_ITEMS = 20;

/** Tope de una dosis (ml o g, por litro o por planta). */
export const MAX_DOSE = 1000;

const round2 = (value: number) => Math.round(value * 100) / 100;

export const readUnit = (value: unknown): DoseUnit => (value === 'g' ? 'g' : 'ml');
export const readBasis = (value: unknown): DoseBasis => (value === 'planta' ? 'planta' : 'litro');

/** "ml/L", "g/L", "ml por planta", "g por planta". */
export function doseUnitLabel(unit: DoseUnit, basis: DoseBasis): string {
  return basis === 'planta' ? `${unit} por planta` : `${unit}/L`;
}

/** Versión corta para dentro de un campo: "ml/L", "g/planta". */
export function doseUnitShort(unit: DoseUnit, basis: DoseBasis): string {
  return basis === 'planta' ? `${unit}/planta` : `${unit}/L`;
}

/**
 * La tabla semanal tal como debería estar: semanas enteras entre 1 y 30, sin
 * repetidas, dosis no negativas, ordenada. Lo que no se entiende se descarta.
 */
export function parseWeeklyDosages(value: unknown): WeeklyDose[] {
  if (!Array.isArray(value)) return [];
  const byWeek = new Map<number, number>();
  for (const item of value) {
    const week = Number((item as WeeklyDose)?.week);
    const dose = parseDecimal((item as WeeklyDose)?.dose) ?? NaN;
    if (!Number.isInteger(week) || week < 1 || week > MAX_WEEKS) continue;
    if (!Number.isFinite(dose) || dose < 0 || dose > MAX_DOSE) continue;
    byWeek.set(week, dose);
  }
  return Array.from(byWeek, ([week, dose]) => ({ week, dose })).sort((a, b) => a.week - b.week);
}

/** Semana de la etapa (1, 2, 3…) a partir de los días que lleva en ella. */
export function weekInStage(daysInStage: number | null | undefined): number {
  const days = Math.max(0, Math.floor(Number(daysInStage) || 0));
  return Math.floor(days / 7) + 1;
}

/** Los días en la etapa con los que arranca una semana (la 3 empieza en el día 14). */
export function stageDaysForWeek(week: number): number {
  return (Math.max(1, Math.floor(week)) - 1) * 7;
}

/**
 * Dosis de un producto para una semana. Con tabla semanal vale la última fila
 * cuya semana no supera la pedida (si la tabla dice semana 1 y semana 4, la
 * semana 3 sigue con la dosis de la 1); antes de la primera fila se usa la
 * primera. Devuelve null si el producto no tiene dosis cargada.
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

/** 2 → "2", 1.5 → "1,5", 0.333 → "0,33", 1250 → "1.250". */
export function formatDose(dose: number): string {
  return round2(dose).toLocaleString('es-AR', { maximumFractionDigits: 2 });
}

/** "5 ml/L", "10 g por planta" o "sin dosis". */
export function formatDoseWithUnit(dose: number | null, unit: DoseUnit, basis: DoseBasis): string {
  return dose === null ? 'sin dosis' : `${formatDose(dose)} ${doseUnitLabel(unit, basis)}`;
}

/** "5 ml/L", "10 g por planta" o "según la semana (ml/L)": la dosis de un producto en palabras. */
export function productDoseText(fertilizer: FertilizerDoseInfo): string {
  const unit = readUnit(fertilizer.unit);
  const basis = readBasis(fertilizer.dose_basis);
  if (fertilizer.dosage_type === 'semanal') return `según la semana (${doseUnitLabel(unit, basis)})`;
  return formatDoseWithUnit(fertilizer.fixed_dosage === null ? null : Number(fertilizer.fixed_dosage), unit, basis);
}

// ---------------------------------------------------------------- Mezcla

/** Un producto de la mezcla. */
export interface MixItem {
  fertilizer_id: number;
  name: string;
  /** La dosis elegida a mano (o la del combo). Null = la del producto para esa semana. */
  custom_dose: number | null;
}

/** Un combo con sus productos y, si la tiene, la dosis de cada uno dentro del combo. */
export interface ComboInfo {
  id: number;
  name?: string;
  products: { fertilizer_id: number; name: string; dose?: number | null }[];
}

/** Un producto de la mezcla con la dosis que va y en qué se mide. */
export interface ResolvedItem {
  fertilizer_id: number;
  name: string;
  dose: number | null;
  /** La dosis no sale del producto: la puso el usuario o el combo. */
  custom: boolean;
  unit: DoseUnit;
  basis: DoseBasis;
  stage_category: FertilizerStage | null;
  /** El producto ya no existe (se borró después de agendar). */
  missing: boolean;
}

const readStage = (value: unknown): FertilizerStage | null =>
  (FERTILIZER_STAGES as readonly string[]).includes(value as string) ? (value as FertilizerStage) : null;

/** La dosis de cada producto de la mezcla para esa semana. */
export function resolveMix(items: MixItem[], fertilizers: FertilizerDoseInfo[], week: number): ResolvedItem[] {
  const byId = new Map(fertilizers.map((fertilizer) => [Number(fertilizer.id), fertilizer]));
  return items.map((item) => {
    const fertilizer = byId.get(Number(item.fertilizer_id));
    const custom = item.custom_dose !== null && item.custom_dose !== undefined;
    return {
      fertilizer_id: Number(item.fertilizer_id),
      name: fertilizer?.name ?? item.name ?? 'Producto',
      dose: custom ? Number(item.custom_dose) : fertilizer ? doseForWeek(fertilizer, week) : null,
      custom,
      unit: readUnit(fertilizer?.unit),
      basis: readBasis(fertilizer?.dose_basis),
      stage_category: readStage(fertilizer?.stage_category),
      missing: !fertilizer,
    };
  });
}

export const RECIPE_PREFIX = 'Preparar:';

/** "Preparar: Lab: 5 ml/L + Minerales: 10 g por planta (semana 3)". */
export function mixRecipe(resolved: ResolvedItem[], week: number): string {
  if (resolved.length === 0) return '';
  const parts = resolved.map((item) =>
    `${item.name}: ${item.dose === null ? '?' : formatDose(item.dose)} ${doseUnitLabel(item.unit, item.basis)}`
  );
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

/** Los detalles sin la línea "Preparar:" (y sin la línea en blanco que la separaba). */
export function stripRecipe(description: string | null | undefined): string {
  const lines = (description ?? '').split('\n');
  const index = lines.findIndex((line) => line.startsWith(RECIPE_PREFIX));
  if (index === -1) return (description ?? '').trim();
  lines.splice(index, lines[index + 1]?.trim() === '' ? 2 : 1);
  return lines.join('\n').trim();
}

/** Los productos de un combo como mezcla, con la dosis propia del combo si la tiene. */
export function comboItems(combo: ComboInfo): MixItem[] {
  return combo.products.map((product) => ({
    fertilizer_id: Number(product.fertilizer_id),
    name: product.name,
    custom_dose: product.dose === null || product.dose === undefined ? null : Number(product.dose),
  }));
}

/** ¿Están todos los productos del combo en la mezcla? */
export function comboIncluded(items: MixItem[], combo: ComboInfo): boolean {
  if (combo.products.length === 0) return false;
  const ids = new Set(items.map((item) => Number(item.fertilizer_id)));
  return combo.products.every((product) => ids.has(Number(product.fertilizer_id)));
}

/**
 * Tocar un combo: si ya estaba entero en la mezcla, saca sus productos; si
 * no, suma los que falten (los que ya estaban quedan con su dosis). Así se
 * puede armar "Flora + un producto más" o juntar dos combos.
 */
export function toggleCombo(items: MixItem[], combo: ComboInfo): MixItem[] {
  const comboIds = new Set(combo.products.map((product) => Number(product.fertilizer_id)));
  if (comboIncluded(items, combo)) return items.filter((item) => !comboIds.has(Number(item.fertilizer_id)));
  const present = new Set(items.map((item) => Number(item.fertilizer_id)));
  return [...items, ...comboItems(combo).filter((item) => !present.has(item.fertilizer_id))];
}

/** Tocar un producto: entra con la dosis del producto, o sale. */
export function toggleProduct(items: MixItem[], product: { id: number; name: string }): MixItem[] {
  const id = Number(product.id);
  return items.some((item) => Number(item.fertilizer_id) === id)
    ? items.filter((item) => Number(item.fertilizer_id) !== id)
    : [...items, { fertilizer_id: id, name: product.name, custom_dose: null }];
}

/** Cambia la dosis de un producto de la mezcla (null vuelve a la del producto). */
export function setItemDose(items: MixItem[], fertilizerId: number, dose: number | null): MixItem[] {
  return items.map((item) =>
    Number(item.fertilizer_id) === Number(fertilizerId) ? { ...item, custom_dose: dose } : item
  );
}

/**
 * Cómo se llama la mezcla: los combos que están enteros y los productos
 * sueltos. "Flora", "Flora + Oro Negro", "Lab + Top Max".
 */
export function mixLabel(items: MixItem[], combos: ComboInfo[] = []): string {
  if (items.length === 0) return '';
  const remaining = new Set(items.map((item) => Number(item.fertilizer_id)));
  const names: string[] = [];
  const ordered = [...combos].filter((combo) => combo.name && combo.products.length > 0)
    .sort((a, b) => b.products.length - a.products.length);
  for (const combo of ordered) {
    const ids = combo.products.map((product) => Number(product.fertilizer_id));
    if (ids.every((id) => remaining.has(id))) {
      names.push(combo.name!);
      ids.forEach((id) => remaining.delete(id));
    }
  }
  for (const item of items) {
    if (remaining.has(Number(item.fertilizer_id))) names.push(item.name);
  }
  return names.join(' + ');
}

// ------------------------------------------------- Lo que guarda la tarea

/** `metadata.nutrition` de una tarea de fertilizante. */
export interface StoredMix {
  version: 2;
  items: MixItem[];
  /** "Flora + Oro Negro", para mostrar sin volver a leer los combos. */
  label: string;
  /** Días en la etapa el día de la tarea: de acá sale la semana. */
  stage_days: number;
  week: number;
  /** La dosis de cada producto para esa semana, como quedó al agendar. */
  resolved: ResolvedItem[];
}

export function buildStoredMix(
  items: MixItem[],
  fertilizers: FertilizerDoseInfo[],
  combos: ComboInfo[],
  stageDays: number
): StoredMix {
  const days = Math.max(0, Math.round(stageDays));
  const week = weekInStage(days);
  const resolved = resolveMix(items, fertilizers, week);
  return {
    version: 2,
    items: resolved.map((item, index) => ({ ...items[index], name: item.name })),
    label: mixLabel(items, combos),
    stage_days: days,
    week,
    resolved,
  };
}

/** La forma vieja de `metadata.nutrition`: un producto o un combo. */
export type NutritionSelection = { type: 'product' | 'combo'; id: number };

export interface MixRead {
  items: MixItem[];
  stage_days: number;
  label: string | null;
  /** Null en las tareas viejas: hay que resolver la mezcla con los productos. */
  resolved: ResolvedItem[] | null;
}

function readItems(value: unknown): MixItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  return value.slice(0, MAX_MIX_ITEMS).flatMap((raw) => {
    const id = Number((raw as MixItem)?.fertilizer_id);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) return [];
    seen.add(id);
    const dose = (raw as MixItem)?.custom_dose;
    const custom = dose === null || dose === undefined ? null : Number(dose);
    const name = (raw as MixItem)?.name;
    return [{
      fertilizer_id: id,
      name: typeof name === 'string' && name ? name : 'Producto',
      custom_dose: custom !== null && Number.isFinite(custom) && custom >= 0 && custom <= MAX_DOSE ? custom : null,
    }];
  });
}

function readResolved(value: unknown): ResolvedItem[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.flatMap((raw) => {
    const row = raw as ResolvedItem;
    const id = Number(row?.fertilizer_id);
    if (!Number.isInteger(id) || id <= 0) return [];
    const dose = row?.dose === null || row?.dose === undefined ? null : Number(row.dose);
    return [{
      fertilizer_id: id,
      name: typeof row?.name === 'string' ? row.name : 'Producto',
      dose: dose !== null && Number.isFinite(dose) ? dose : null,
      custom: row?.custom === true,
      unit: readUnit(row?.unit),
      basis: readBasis(row?.basis),
      stage_category: readStage(row?.stage_category),
      missing: row?.missing === true,
    }];
  });
  return items.length > 0 ? items : null;
}

/**
 * Lee `metadata.nutrition`: la forma nueva o la vieja (`{ type, id, week }`),
 * que se convierte con los combos y productos actuales. Null si la tarea no
 * tiene mezcla.
 */
export function readStoredMix(
  metadata: unknown,
  combos: ComboInfo[] = [],
  fertilizers: { id: number; name: string }[] = []
): MixRead | null {
  const raw = (metadata as { nutrition?: unknown } | null)?.nutrition as Record<string, unknown> | null | undefined;
  if (!raw || typeof raw !== 'object') return null;

  if (Array.isArray(raw.items)) {
    const items = readItems(raw.items);
    if (items.length === 0) return null;
    const days = Number(raw.stage_days);
    const week = Number(raw.week);
    return {
      items,
      stage_days: Number.isFinite(days) && days >= 0 ? Math.round(days) : stageDaysForWeek(Number.isFinite(week) ? week : 1),
      label: typeof raw.label === 'string' ? raw.label : null,
      resolved: readResolved(raw.resolved),
    };
  }

  const id = Number(raw.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  const week = Number(raw.week);
  const stage_days = stageDaysForWeek(Number.isFinite(week) && week >= 1 ? week : 1);

  if (raw.type === 'product') {
    const name = fertilizers.find((fertilizer) => Number(fertilizer.id) === id)?.name ?? 'Producto';
    return { items: [{ fertilizer_id: id, name, custom_dose: null }], stage_days, label: null, resolved: null };
  }
  if (raw.type === 'combo') {
    const combo = combos.find((item) => Number(item.id) === id);
    if (!combo || combo.products.length === 0) return null;
    return { items: comboItems(combo), stage_days, label: combo.name ?? null, resolved: null };
  }
  return null;
}

/** ¿La tarea tiene una mezcla guardada (nueva o vieja)? */
export function hasStoredMix(metadata: unknown): boolean {
  const raw = (metadata as { nutrition?: unknown } | null)?.nutrition as Record<string, unknown> | null | undefined;
  if (!raw || typeof raw !== 'object') return false;
  if (Array.isArray(raw.items)) return raw.items.length > 0;
  return (raw.type === 'product' || raw.type === 'combo') && Number(raw.id) > 0;
}

/**
 * Valida la mezcla que manda el cliente: productos (sin repetidos, hasta 20),
 * dosis propias entre 0 y 1000 y los días en etapa. Null si no hay mezcla;
 * 'invalid' si algo no se entiende.
 */
export function parseMixInput(value: unknown): { items: MixItem[]; stage_days: number } | null | 'invalid' {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return 'invalid';
  const rawItems = (value as { items?: unknown }).items;
  if (rawItems === undefined || rawItems === null) return null;
  if (!Array.isArray(rawItems) || rawItems.length > MAX_MIX_ITEMS) return 'invalid';

  const seen = new Set<number>();
  const items: MixItem[] = [];
  for (const raw of rawItems) {
    const id = Number((raw as MixItem)?.fertilizer_id);
    if (!Number.isInteger(id) || id <= 0) return 'invalid';
    if (seen.has(id)) continue;
    seen.add(id);

    const rawDose = (raw as MixItem)?.custom_dose as unknown;
    let custom: number | null = null;
    if (rawDose !== null && rawDose !== undefined && rawDose !== '') {
      const dose = parseDecimal(rawDose);
      if (dose === undefined || !Number.isFinite(dose) || dose < 0 || dose > MAX_DOSE) return 'invalid';
      custom = round2(dose);
    }
    const name = (raw as MixItem)?.name;
    items.push({ fertilizer_id: id, name: typeof name === 'string' ? name.slice(0, 80) : 'Producto', custom_dose: custom });
  }
  if (items.length === 0) return null;

  const rawDays = Number((value as { stage_days?: unknown }).stage_days ?? 0);
  if (!Number.isFinite(rawDays) || rawDays < 0 || rawDays > 400) return 'invalid';
  return { items, stage_days: Math.round(rawDays) };
}

// ---------------------------------------------------------------- Etapas

const STAGE_TO_CATEGORY: Record<string, FertilizerStage> = {
  'Germinación': 'enraizamiento',
  'Plántula': 'enraizamiento',
  'Enraizamiento': 'enraizamiento',
  'Vegetativo': 'vegetativo',
  'Floración': 'floracion',
};

/** La categoría de producto que corresponde a una etapa de la planta. */
export function stageCategory(stage: string | null | undefined): FertilizerStage | null {
  return stage ? STAGE_TO_CATEGORY[stage] ?? null : null;
}

/** ¿El producto es para esa etapa? Sin etapa o "todo el ciclo" siempre va. */
export function fitsStage(category: string | null | undefined, stage: string | null | undefined): boolean {
  if (!category || category === 'todo') return true;
  const target = stageCategory(stage);
  if (!target) return true;
  if (category === 'lavado') return target === 'floracion';
  return category === target;
}

export interface StageWarning {
  fertilizer_id: number;
  name: string;
  category: FertilizerStage;
  /** Las etapas de las plantas en las que no corresponde. */
  stages: string[];
}

/** Los productos de la mezcla que no son para la etapa en que están las plantas. */
export function stageWarnings(
  items: { fertilizer_id: number; name: string; stage_category: string | null | undefined }[],
  stages: (string | null | undefined)[]
): StageWarning[] {
  const known = Array.from(new Set(stages.filter((stage): stage is string => Boolean(stageCategory(stage)))));
  return items.flatMap((item) => {
    const category = readStage(item.stage_category);
    if (!category) return [];
    const misfit = known.filter((stage) => !fitsStage(category, stage));
    return misfit.length > 0 ? [{ fertilizer_id: item.fertilizer_id, name: item.name, category, stages: misfit }] : [];
  });
}

/** "Oro Negro es de vegetativo y las plantas están en floración." */
export function stageWarningText(warning: StageWarning): string {
  const stages = warning.stages.map((stage) => stage.toLowerCase()).join(' y ');
  const where = warning.stages.length === 1 ? `las plantas están en ${stages}` : `hay plantas en ${stages}`;
  return `${warning.name} es de ${FERTILIZER_STAGE_LABELS[warning.category].toLowerCase()} y ${where}.`;
}

// ------------------------------------------------------------------- Uso

export interface UsageLine {
  fertilizer_id: number;
  name: string;
  unit: DoseUnit;
  basis: DoseBasis;
  /** La dosis (por litro o por planta). */
  dose: number | null;
  /** Lo que se usa en total, o null si falta la dosis, los litros o las plantas. */
  total: number | null;
}

/** Cuánto de cada producto: dosis × litros, o dosis × plantas si va por planta. */
export function mixUsage(resolved: ResolvedItem[], liters: number, plants: number): UsageLine[] {
  const validLiters = Number.isFinite(liters) && liters > 0;
  const validPlants = Number.isFinite(plants) && plants > 0;
  return resolved.map((item) => {
    const base = item.basis === 'planta' ? (validPlants ? plants : null) : (validLiters ? liters : null);
    return {
      fertilizer_id: item.fertilizer_id,
      name: item.name,
      unit: item.unit,
      basis: item.basis,
      dose: item.dose,
      total: item.dose === null || base === null ? null : round2(item.dose * base),
    };
  });
}

/** "Lab: 50 ml + Minerales: 30 g (10 L, semana 3)". */
export function describeUsage(lines: UsageLine[], liters: number, week: number): string {
  if (lines.length === 0) return '';
  const parts = lines.map((line) => `${line.name}: ${line.total === null ? '?' : `${formatDose(line.total)} ${line.unit}`}`);
  const context = liters > 0 ? `${formatDose(liters)} L, semana ${week}` : `semana ${week}`;
  return `${parts.join(' + ')} (${context})`;
}

// -------------------------------------------------------------- Bitácora

/** `logs.data.feed`: lo que se le dio a una planta en un riego o una tarea. */
export interface FeedLog {
  label: string;
  week: number;
  liters_total: number | null;
  /** Entre cuántas plantas se repartió. */
  plants: number;
  items: { fertilizer_id: number; name: string; dose: number | null; custom: boolean; unit: DoseUnit; basis: DoseBasis }[];
  /** Lo que le tocó a esta planta de cada producto. */
  usage: { fertilizer_id: number; name: string; amount: number; unit: DoseUnit }[];
}

/**
 * Arma el registro de bitácora de una mezcla aplicada a `plants` plantas, y
 * el total de cada producto (para el stock). Cada planta se queda con su
 * parte: así, sumar los registros de un ciclo da lo que se usó de verdad.
 */
export function buildFeedLog(
  mix: { label: string; week: number; resolved: ResolvedItem[] },
  liters: number | null,
  plants: number
): { feed: FeedLog; totals: UsageLine[] } {
  const count = Math.max(1, Math.floor(plants) || 1);
  const totals = mixUsage(mix.resolved, liters ?? 0, count);
  return {
    totals,
    feed: {
      label: mix.label,
      week: mix.week,
      liters_total: liters && liters > 0 ? round2(liters) : null,
      plants: count,
      items: mix.resolved.map((item) => ({
        fertilizer_id: item.fertilizer_id, name: item.name, dose: item.dose, custom: item.custom, unit: item.unit, basis: item.basis,
      })),
      usage: totals
        .filter((line): line is UsageLine & { total: number } => line.total !== null && line.total > 0)
        .map((line) => ({ fertilizer_id: line.fertilizer_id, name: line.name, amount: round2(line.total / count), unit: line.unit })),
    },
  };
}

/** "Flora: Lab 5 ml/L + Top Max 1 ml/L · 10 L en total · semana 3". */
export function describeFeed(feed: FeedLog): string {
  const doses = feed.items.map((item) => `${item.name} ${formatDoseWithUnit(item.dose, item.unit, item.basis)}`).join(' + ');
  // El nombre sólo suma si es un combo ("Flora: …"), no la lista de productos de nuevo.
  const plain = feed.items.map((item) => item.name).join(' + ');
  const parts = [feed.label && feed.label !== plain ? `${feed.label}: ${doses}` : doses];
  if (feed.liters_total) parts.push(`${formatDose(feed.liters_total)} L${feed.plants > 1 ? ' en total' : ''}`);
  parts.push(`semana ${feed.week}`);
  return parts.join(' · ');
}

/** La mezcla de un registro, para repetirla: las dosis propias se mantienen. */
export function feedItems(feed: FeedLog): MixItem[] {
  return feed.items.map((item) => ({
    fertilizer_id: item.fertilizer_id,
    name: item.name,
    custom_dose: item.custom ? item.dose : null,
  }));
}

/** Lee `logs.data.feed`, o null si el registro no tiene mezcla. */
export function readFeed(data: unknown): FeedLog | null {
  const raw = (data as { feed?: unknown } | null)?.feed as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.items)) return null;
  const items = raw.items.flatMap((item) => {
    const row = item as FeedLog['items'][number];
    const id = Number(row?.fertilizer_id);
    if (!Number.isInteger(id) || id <= 0) return [];
    const dose = row?.dose === null || row?.dose === undefined ? null : Number(row.dose);
    return [{
      fertilizer_id: id,
      name: typeof row?.name === 'string' ? row.name : 'Producto',
      dose: dose !== null && Number.isFinite(dose) ? dose : null,
      custom: row?.custom === true,
      unit: readUnit(row?.unit),
      basis: readBasis(row?.basis),
    }];
  });
  const usage = (Array.isArray(raw.usage) ? raw.usage : []).flatMap((item) => {
    const row = item as FeedLog['usage'][number];
    const id = Number(row?.fertilizer_id);
    const amount = Number(row?.amount);
    if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(amount) || amount <= 0) return [];
    return [{ fertilizer_id: id, name: typeof row?.name === 'string' ? row.name : 'Producto', amount, unit: readUnit(row?.unit) }];
  });
  const liters = Number(raw.liters_total);
  return {
    label: typeof raw.label === 'string' ? raw.label : '',
    week: Number(raw.week) || 1,
    liters_total: Number.isFinite(liters) && liters > 0 ? liters : null,
    plants: Math.max(1, Number(raw.plants) || 1),
    items,
    usage,
  };
}

export interface FeedTotal {
  fertilizer_id: number;
  name: string;
  unit: DoseUnit;
  /** Lo usado en total (sólo cuenta lo que tenía litros o plantas). */
  amount: number;
  /** En cuántos días distintos se aplicó. */
  days: number;
}

/** Cuánto se usó de cada producto en un grupo de registros (un ciclo). */
export function sumFeed(rows: { data: unknown; created_at: string | null }[]): FeedTotal[] {
  const totals = new Map<string, FeedTotal & { dayKeys: Set<string> }>();
  for (const row of rows) {
    const feed = readFeed(row.data);
    if (!feed) continue;
    const day = dateKey(row.created_at) ?? '';
    for (const item of feed.items) {
      const key = `${item.fertilizer_id}-${item.unit}`;
      const entry = totals.get(key) ?? { fertilizer_id: item.fertilizer_id, name: item.name, unit: item.unit, amount: 0, days: 0, dayKeys: new Set<string>() };
      if (day) entry.dayKeys.add(day);
      totals.set(key, entry);
    }
    for (const line of feed.usage) {
      const entry = totals.get(`${line.fertilizer_id}-${line.unit}`);
      if (entry) entry.amount = round2(entry.amount + line.amount);
    }
  }
  return Array.from(totals.values())
    .map(({ dayKeys, ...entry }) => ({ ...entry, days: dayKeys.size }))
    .sort((a, b) => b.amount - a.amount || b.days - a.days || a.name.localeCompare(b.name));
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
