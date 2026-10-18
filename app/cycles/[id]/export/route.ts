import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase-server'
import { getCurrentUser } from '@/app/lib/auth'
import { parseId } from '@/app/lib/sanitize'
import { toCsv, fileSlug } from '@/app/lib/csv'
import type { CsvValue } from '@/app/lib/csv'
import { dateKey } from '@/app/lib/dates'
import { vpd } from '@/app/lib/climate'
import { readWatering } from '@/app/lib/watering'
import { canonicalLogType } from '@/app/lib/logs'

const KINDS = ['plantas', 'bitacora', 'clima', 'cosechas'] as const
type Kind = (typeof KINDS)[number]

/**
 * Descarga en CSV de un ciclo: plantas, bitácora, clima o cosechas. Con la
 * sesión del usuario (la RLS decide qué puede leer), así que un id ajeno da
 * un ciclo vacío, no los datos de otro.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Hace falta iniciar sesión.' }, { status: 401 })

  const { id: rawId } = await params
  const id = parseId(rawId)
  const kind = new URL(request.url).searchParams.get('tipo') as Kind | null
  if (!id || !kind || !KINDS.includes(kind)) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })

  const supabase = await createClient()
  const { data: cycle } = await supabase.from('cycles').select('id, name').eq('id', id).maybeSingle()
  if (!cycle) return NextResponse.json({ error: 'No se encontró el ciclo.' }, { status: 404 })

  let rows: CsvValue[][] = []

  if (kind === 'plantas') {
    const { data } = await supabase
      .from('plants')
      .select('name, strain, breeder, source_type, stage, is_archived, is_mother, planted_at, date_germinacion, date_plantula, date_enraizamiento, date_vegetativo, date_floracion, date_secado, date_curado, last_water')
      .eq('cycle_id', id)
      .order('id')
    rows = [
      ['Planta', 'Genética', 'Banco', 'Origen', 'Etapa', 'Archivada', 'Madre', 'Plantada', 'Germinación', 'Plántula', 'Enraizamiento', 'Vegetativo', 'Floración', 'Secado', 'Curado', 'Último riego'],
      ...(data ?? []).map((p) => [
        p.name, p.strain, p.breeder, p.source_type, p.stage, Boolean(p.is_archived), Boolean(p.is_mother),
        dateKey(p.planted_at), dateKey(p.date_germinacion), dateKey(p.date_plantula), dateKey(p.date_enraizamiento),
        dateKey(p.date_vegetativo), dateKey(p.date_floracion), dateKey(p.date_secado), dateKey(p.date_curado), dateKey(p.last_water),
      ]),
    ]
  } else if (kind === 'bitacora') {
    const { data } = await supabase
      .from('logs')
      .select('created_at, type, title, notes, data, plants ( name )')
      .eq('cycle_id', id)
      .order('created_at')
    rows = [
      ['Fecha', 'Planta', 'Tipo', 'Título', 'Notas', 'Litros', 'pH', 'EC'],
      ...(data ?? []).map((log) => {
        const plant = Array.isArray(log.plants) ? log.plants[0] : log.plants
        const watering = readWatering(log.data)
        return [
          dateKey(log.created_at), plant?.name ?? '', canonicalLogType(log.type), log.title, log.notes,
          watering?.liters_per_plant ?? watering?.liters_total, watering?.ph, watering?.ec,
        ]
      }),
    ]
  } else if (kind === 'clima') {
    const { data } = await supabase
      .from('measurements')
      .select('date, created_at, temperature, humidity')
      .eq('cycle_id', id)
      .order('date')
      .order('created_at')
    rows = [
      ['Fecha', 'Temperatura (°C)', 'Humedad (%)', 'VPD (kPa)'],
      ...(data ?? []).map((m) => {
        const v = vpd(m.temperature, m.humidity)
        return [m.date, m.temperature, m.humidity, v === null ? null : Math.round(v * 100) / 100]
      }),
    ]
  } else {
    const { data } = await supabase
      .from('harvests')
      .select('harvested_on, dried_on, wet_g, dry_g, rating, notes, plants ( name, strain )')
      .eq('cycle_id', id)
      .order('harvested_on')
    rows = [
      ['Planta', 'Genética', 'Cosechada', 'Fin del secado', 'Húmedo (g)', 'Seco (g)', 'Calificación', 'Notas'],
      ...(data ?? []).map((h) => {
        const plant = Array.isArray(h.plants) ? h.plants[0] : h.plants
        return [plant?.name ?? '', plant?.strain ?? '', h.harvested_on, h.dried_on, h.wet_g, h.dry_g, h.rating, h.notes]
      }),
    ]
  }

  const filename = `${fileSlug(cycle.name)}-${kind}.csv`
  return new NextResponse(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
