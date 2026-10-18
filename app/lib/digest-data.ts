import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { dominantStage, stageClimate, vpd, vpdLevel, DEFAULT_VPD_RANGE } from './climate';
import { addDaysToKey, dayRange, dateKey, todayKey } from './dates';
import type { DigestInput, NotificationPrefs } from './notifications';

type Client = SupabaseClient<Database>;

/**
 * Lo que hace falta para el aviso del día de un usuario. Filtra por user_id
 * a mano porque el envío diario usa la clave de servicio (sin RLS); con el
 * cliente del usuario el filtro es redundante pero inofensivo.
 */
export async function loadDigestInput(supabase: Client, userId: string, prefs: NotificationPrefs): Promise<DigestInput> {
  const today = todayKey();
  const { from, to } = dayRange(today);
  const recent = addDaysToKey(today, -2);

  const [todayTasks, overdue, cycles, fertilizers] = await Promise.all([
    supabase.from('tasks').select('title').eq('user_id', userId).eq('status', 'pending').gte('due_date', from).lt('due_date', to).order('due_date'),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'pending').lt('due_date', from),
    prefs.climate
      ? supabase
          .from('cycles')
          .select('id, name, plants ( stage, is_archived ), measurements ( date, created_at, temperature, humidity )')
          .eq('user_id', userId)
          .eq('is_active', true)
          .gte('measurements.date', recent)
      : Promise.resolve({ data: [] }),
    prefs.stock
      ? supabase.from('fertilizers').select('name, stock_ml, low_stock_ml').eq('user_id', userId).not('stock_ml', 'is', null).not('low_stock_ml', 'is', null)
      : Promise.resolve({ data: [] }),
  ]);

  const climateAlerts: DigestInput['climateAlerts'] = [];
  for (const cycle of (cycles.data ?? []) as {
    name: string
    plants: { stage: string | null; is_archived: boolean | null }[] | null
    measurements: { date: string | null; created_at: string | null; temperature: number | null; humidity: number | null }[] | null
  }[]) {
    // La medición más reciente de los últimos dos días.
    const latest = [...(cycle.measurements ?? [])].sort((a, b) =>
      String(dateKey(b.date) ?? '').localeCompare(String(dateKey(a.date) ?? '')) || String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
    )[0];
    if (!latest) continue;
    const value = vpd(latest.temperature, latest.humidity);
    const range = stageClimate(dominantStage(cycle.plants ?? []))?.vpd ?? DEFAULT_VPD_RANGE;
    const level = vpdLevel(value, range);
    if (value !== null && (level === 'low' || level === 'high')) climateAlerts.push({ cycle: cycle.name, level, vpd: Math.round(value * 100) / 100 });
  }

  return {
    todayTasks: (todayTasks.data ?? []).map((task) => ({ title: task.title })),
    overdue: overdue.count ?? 0,
    climateAlerts,
    lowStock: ((fertilizers.data ?? []) as { name: string; stock_ml: number | null; low_stock_ml: number | null }[])
      .filter((row) => Number(row.stock_ml) <= Number(row.low_stock_ml))
      .map((row) => ({ name: row.name })),
    prefs,
  };
}
