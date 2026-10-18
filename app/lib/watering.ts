/**
 * RIEGO CON DATOS
 * ------------------------------------------------------------------
 * pH, EC y litros de cada riego, que se guardan en `logs.data.watering`. Con
 * eso la bitácora deja de decir sólo "Riego" y se puede ver qué se le dio a
 * cada planta. Acá se validan los valores y se arma el texto que se muestra;
 * también la calculadora de dosis (ml de cada producto para esos litros).
 */

import type { RecipeItem } from './nutrition.ts';
import { formatDose } from './nutrition.ts';

export interface WateringData {
  /** Litros en total del riego. */
  liters_total?: number;
  /** Litros por planta (el total repartido entre las plantas regadas). */
  liters_per_plant?: number;
  ph?: number;
  /** Conductividad en mS/cm. */
  ec?: number;
  runoff_ph?: number;
  runoff_ec?: number;
  /** °C */
  water_temp?: number;
}

const LIMITS: Record<'liters_total' | 'ph' | 'ec' | 'runoff_ph' | 'runoff_ec' | 'water_temp', { min: number; max: number; label: string }> = {
  liters_total: { min: 0, max: 10000, label: 'los litros' },
  ph: { min: 0, max: 14, label: 'el pH' },
  ec: { min: 0, max: 10, label: 'la EC' },
  runoff_ph: { min: 0, max: 14, label: 'el pH del drenaje' },
  runoff_ec: { min: 0, max: 10, label: 'la EC del drenaje' },
  water_temp: { min: 0, max: 45, label: 'la temperatura del agua' },
};

/** "6,2" o "6.2" → 6.2; vacío → undefined; basura → NaN. */
function readNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return value;
  const text = String(value).trim().replace(',', '.');
  if (text === '') return undefined;
  return Number(text);
}

/**
 * Valida lo que llega del formulario. Devuelve los datos limpios o el primer
 * error en palabras. `plantCount` reparte los litros por planta.
 */
export function parseWateringData(input: unknown, plantCount = 1): { data: WateringData; error: null } | { data: null; error: string } {
  const raw = (input ?? {}) as Record<string, unknown>;
  const data: WateringData = {};

  for (const [field, limit] of Object.entries(LIMITS) as [keyof typeof LIMITS, (typeof LIMITS)[keyof typeof LIMITS]][]) {
    const value = readNumber(raw[field]);
    if (value === undefined) continue;
    if (!Number.isFinite(value) || value < limit.min || value > limit.max) {
      return { data: null, error: `Revisá ${limit.label}: tiene que estar entre ${limit.min} y ${limit.max}.` };
    }
    data[field] = Math.round(value * 100) / 100;
  }

  if (data.liters_total !== undefined && plantCount > 0) {
    data.liters_per_plant = Math.round((data.liters_total / plantCount) * 100) / 100;
  }

  return { data, error: null };
}

export function hasWateringData(data: WateringData | null | undefined): boolean {
  return Boolean(data) && Object.keys(data as object).length > 0;
}

/** Lee `logs.data.watering` de un registro, si lo tiene. */
export function readWatering(logData: unknown): WateringData | null {
  const watering = (logData as { watering?: unknown } | null)?.watering;
  if (!watering || typeof watering !== 'object') return null;
  const result: WateringData = {};
  for (const key of ['liters_total', 'liters_per_plant', 'ph', 'ec', 'runoff_ph', 'runoff_ec', 'water_temp'] as const) {
    const value = (watering as Record<string, unknown>)[key];
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
  }
  return hasWateringData(result) ? result : null;
}

const fmt = (value: number, decimals = 2) =>
  value.toLocaleString('es-AR', { maximumFractionDigits: decimals });

/** EC (mS/cm) a ppm en escala 500, la de la mayoría de los medidores baratos. */
export function ecToPpm(ec: number, scale: 500 | 700 = 500): number {
  return Math.round(ec * scale);
}

/** "1,5 L por planta · pH 6,2 · EC 1,4 (700 ppm) · drenaje pH 6,5" */
export function describeWatering(data: WateringData): string {
  const parts: string[] = [];
  if (data.liters_per_plant !== undefined && data.liters_total !== undefined && data.liters_per_plant !== data.liters_total) {
    parts.push(`${fmt(data.liters_per_plant)} L por planta (${fmt(data.liters_total)} L en total)`);
  } else if (data.liters_total !== undefined) {
    parts.push(`${fmt(data.liters_total)} L`);
  }
  if (data.ph !== undefined) parts.push(`pH ${fmt(data.ph, 1)}`);
  if (data.ec !== undefined) parts.push(`EC ${fmt(data.ec)} (${ecToPpm(data.ec)} ppm)`);
  if (data.water_temp !== undefined) parts.push(`agua a ${fmt(data.water_temp, 1)} °C`);
  const runoff: string[] = [];
  if (data.runoff_ph !== undefined) runoff.push(`pH ${fmt(data.runoff_ph, 1)}`);
  if (data.runoff_ec !== undefined) runoff.push(`EC ${fmt(data.runoff_ec)}`);
  if (runoff.length > 0) parts.push(`drenaje ${runoff.join(', ')}`);
  return parts.join(' · ');
}

export interface DoseLine {
  fertilizerId: number;
  name: string;
  /** ml/L, o null si el producto no tiene dosis cargada. */
  perLiter: number | null;
  /** ml para los litros pedidos. */
  total: number | null;
}

/** Cuántos ml de cada producto van en `liters` litros de agua. */
export function doseForLiters(items: RecipeItem[], liters: number): DoseLine[] {
  const valid = Number.isFinite(liters) && liters > 0;
  return items.map((item) => ({
    fertilizerId: item.fertilizerId,
    name: item.name,
    perLiter: item.dose,
    total: item.dose === null || !valid ? null : Math.round(item.dose * liters * 100) / 100,
  }));
}

/** "Grow A: 20 ml + Bloom B: 15 ml (10 L, semana 3)" para la nota del riego. */
export function describeDoses(lines: DoseLine[], liters: number, week: number): string {
  if (lines.length === 0) return '';
  const parts = lines.map((line) => `${line.name}: ${line.total === null ? '?' : `${formatDose(line.total)} ml`}`);
  return `${parts.join(' + ')} (${fmt(liters)} L, semana ${week})`;
}
