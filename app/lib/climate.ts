/**
 * CLIMA
 * ------------------------------------------------------------------
 * VPD (déficit de presión de vapor) a partir de temperatura y humedad, y su
 * diagnóstico. Puro, para usarlo en la ficha del ciclo y en el historial.
 */

/** Presión de vapor de saturación en kPa (fórmula de Tetens). */
export function saturationVaporPressure(temperature: number): number {
  return 0.61078 * Math.exp((17.27 * temperature) / (temperature + 237.3));
}

/** VPD del aire en kPa, o null si falta algún dato o no tiene sentido. */
export function vpd(temperature: number | null | undefined, humidity: number | null | undefined): number | null {
  const t = Number(temperature);
  const h = Number(humidity);
  if (temperature === null || temperature === undefined || humidity === null || humidity === undefined) return null;
  if (!Number.isFinite(t) || !Number.isFinite(h) || h < 0 || h > 100) return null;
  return saturationVaporPressure(t) * (1 - h / 100);
}

export type VpdLevel = 'low' | 'ok' | 'high' | 'unknown';

export interface VpdRange {
  min: number;
  max: number;
}

/** Rango sano por defecto, cuando no se sabe en qué etapa está el ciclo. */
export const DEFAULT_VPD_RANGE: VpdRange = { min: 0.4, max: 1.6 };

export function vpdLevel(value: number | null, range: VpdRange = DEFAULT_VPD_RANGE): VpdLevel {
  if (value === null) return 'unknown';
  if (value < range.min) return 'low';
  if (value > range.max) return 'high';
  return 'ok';
}
