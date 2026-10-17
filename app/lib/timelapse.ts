/**
 * TIMELAPSE DEL CICLO
 * ------------------------------------------------------------------
 * Junta en una sola línea de tiempo las fotos de la galería del ciclo y las
 * de la bitácora de sus plantas, de la más vieja a la más nueva, cada una con
 * su día de cultivo y la etapa en la que estaba el ciclo. Puro: la página
 * trae las filas y el reproductor sólo muestra.
 */

import { dateKey, daysBetweenKeys } from './dates.ts';
import { stageOnDay } from './climate.ts';
import type { StagePeriod } from './climate.ts';
import type { StageName } from './stage-logic.ts';

export interface TimelapseFrame {
  /** Único dentro del timelapse. */
  id: string;
  url: string;
  /** Instante ISO de la foto. */
  at: string;
  /** Día de cultivo (0 el día que arrancó el ciclo). */
  day: number;
  stage: StageName | null;
  /** La planta de la foto, si es de la bitácora de una planta. */
  plantId: number | null;
  caption: string | null;
}

export interface GalleryImage {
  id: string;
  public_url: string;
  taken_at: string | null;
  created_at: string | null;
  description: string | null;
}

export interface PhotoLog {
  id: number;
  plant_id: number | null;
  created_at: string | null;
  media_url: string[] | null;
  title: string | null;
}

/**
 * Los cuadros del timelapse. Una misma foto puede estar en la galería y en la
 * bitácora (o repetida en un registro): se muestra una sola vez.
 */
export function buildTimelapseFrames(options: {
  cycleStart: string | null;
  gallery: GalleryImage[];
  logs: PhotoLog[];
  periods: StagePeriod[];
  plantNames?: Map<number, string>;
}): TimelapseFrame[] {
  const { cycleStart, gallery, logs, periods, plantNames } = options;
  const startKey = dateKey(cycleStart);
  const seen = new Set<string>();
  const frames: TimelapseFrame[] = [];

  const add = (frame: Omit<TimelapseFrame, 'day' | 'stage'>) => {
    if (!frame.url || seen.has(frame.url)) return;
    const key = dateKey(frame.at);
    if (!key) return;
    seen.add(frame.url);
    frames.push({
      ...frame,
      day: startKey ? Math.max(0, daysBetweenKeys(startKey, key)) : 0,
      stage: stageOnDay(key, periods),
    });
  };

  for (const image of gallery) {
    add({
      id: `g-${image.id}`,
      url: image.public_url,
      at: image.taken_at ?? image.created_at ?? '',
      plantId: null,
      caption: image.description,
    });
  }

  for (const log of logs) {
    (log.media_url ?? []).forEach((url, index) => {
      add({
        id: `l-${log.id}-${index}`,
        url,
        at: log.created_at ?? '',
        plantId: log.plant_id,
        caption: (log.plant_id != null ? plantNames?.get(log.plant_id) : null) ?? log.title,
      });
    });
  }

  return frames.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

/** Las plantas que tienen fotos propias, para filtrar el timelapse por planta. */
export function plantsWithFrames(frames: TimelapseFrame[]): number[] {
  return Array.from(new Set(frames.map((frame) => frame.plantId).filter((id): id is number => id !== null)));
}
