import Image from 'next/image'
import type { ReactNode } from 'react'
import { climateByStage, climateSeries, dominantStage, stageClimate, stagePeriods } from '@/app/lib/climate'
import type { MeasurementLike } from '@/app/lib/climate'
import { daysSinceDate, formatDay } from '@/app/lib/dates'
import { cycleYield } from '@/app/lib/harvest'
import type { HarvestRow, SpaceSize } from '@/app/lib/harvest'
import { getPlantMetrics } from '@/app/lib/plant-metrics'
import type { PlantDates } from '@/app/lib/plant-metrics'
import { buildTimelapseFrames } from '@/app/lib/timelapse'
import type { GalleryImage } from '@/app/lib/timelapse'
import ClimateHistory from './ClimateHistory'
import CycleTimelapse from './CycleTimelapse'

export type ReportPlant = PlantDates & {
  id: number
  name: string
  strain?: string | null
  source_type?: string | null
  is_archived?: boolean | null
}

export interface ReportData {
  cycle: {
    name: string
    start_date: string | null
    is_active: boolean | null
    space: (SpaceSize & { name: string; type: string | null }) | null
  }
  plants: ReportPlant[]
  measurements: MeasurementLike[]
  images: GalleryImage[]
  harvests: HarvestRow[]
}

const grams = (value: number | null, unit = 'g', decimals = 1) =>
  value === null ? '–' : `${value.toLocaleString('es-AR', { maximumFractionDigits: decimals })} ${unit}`

/**
 * Un ciclo entero en una página: resumen, plantas, clima, fotos y cosecha.
 * Es el reporte para imprimir y también lo que ve quien recibe el enlace para
 * compartir (con los datos que devuelve `get_shared_cycle`).
 */
export default function CycleReport({ data, actions, footer }: { data: ReportData; actions?: ReactNode; footer?: ReactNode }) {
  const { cycle, plants, measurements, images, harvests } = data
  const active = plants.filter((plant) => !plant.is_archived)
  const stage = dominantStage(active)
  const periods = stagePeriods(plants)
  const points = climateSeries(measurements)
  const byStage = climateByStage(points, periods)
  const yieldData = cycleYield(harvests, cycle.space)
  const harvestByPlant = new Map(harvests.map((harvest) => [Number(harvest.plant_id), harvest]))
  const frames = buildTimelapseFrames({
    cycleStart: cycle.start_date,
    gallery: images,
    logs: [],
    periods,
  })
  const day = daysSinceDate(cycle.start_date)

  return (
    <article className="space-y-8 print:space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-title text-2xl font-semibold text-fg sm:text-3xl">{cycle.name}</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {cycle.space?.name ? `${cycle.space.name}${cycle.space.type ? ` · ${cycle.space.type}` : ''} · ` : ''}
            {cycle.start_date ? `Arrancó el ${formatDay(cycle.start_date)}` : 'Sin fecha de inicio'}
            {cycle.is_active ? '' : ' · Finalizado'}
          </p>
        </div>
        {actions && <div className="flex flex-wrap gap-2 print:hidden">{actions}</div>}
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Día de cultivo" value={day === null ? '–' : String(day)} />
        <Metric label="Plantas" value={String(active.length)} hint={active.length !== plants.length ? `de ${plants.length}` : undefined} />
        <Metric label="Etapa" value={stage ?? '–'} />
        <Metric
          label="Seco total"
          value={grams(yieldData.dryTotal)}
          hint={yieldData.dryPerPlant !== null ? `${grams(yieldData.dryPerPlant)} por planta` : undefined}
        />
        {yieldData.perSquareMeter !== null && <Metric label="Por m²" value={grams(yieldData.perSquareMeter)} />}
        {yieldData.perWatt !== null && <Metric label="Por watt" value={grams(yieldData.perWatt, 'g/W', 2)} />}
      </dl>

      <section aria-labelledby="r-plantas" className="space-y-3">
        <h2 id="r-plantas" className="section-title">Plantas</h2>
        <div className="surface overflow-x-auto rounded-[var(--radius-lg)]">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="text-left text-xs text-fg-muted">
              <tr className="border-b border-line">
                <th scope="col" className="px-4 py-2.5 font-semibold">Planta</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Genética</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Etapa</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Días en etapa</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Edad</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Seco</th>
              </tr>
            </thead>
            <tbody>
              {plants.map((plant) => {
                const metrics = getPlantMetrics(plant)
                const harvest = harvestByPlant.get(plant.id)
                return (
                  <tr key={plant.id} className="border-b border-line last:border-0">
                    <th scope="row" className={`px-4 py-2.5 text-left font-medium ${plant.is_archived ? 'text-fg-muted' : 'text-fg'}`}>
                      {plant.name}
                      {plant.is_archived && <span className="ml-1.5 text-xs font-normal text-fg-subtle">archivada</span>}
                    </th>
                    <td className="px-3 py-2.5 text-fg">{plant.strain || '–'}</td>
                    <td className="px-3 py-2.5 text-fg">{metrics.currentStage || '–'}</td>
                    <td className="mono px-3 py-2.5 text-right text-fg">{metrics.daysInCurrentStage}</td>
                    <td className="mono px-3 py-2.5 text-right text-fg">{metrics.totalAge}</td>
                    <td className="mono px-4 py-2.5 text-right text-fg">{grams(harvest?.dry_g ?? null)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="r-clima" className="space-y-3 print:break-inside-avoid">
        <h2 id="r-clima" className="section-title">Clima</h2>
        <ClimateHistory points={points} stageLabel={stage} climate={stageClimate(stage)} byStage={byStage} />
      </section>

      {images.length > 0 && (
        <section aria-labelledby="r-fotos" className="space-y-3">
          <div className="flex items-center justify-between gap-3 print:break-after-avoid">
            <h2 id="r-fotos" className="section-title">Fotos</h2>
            <div className="print:hidden"><CycleTimelapse frames={frames} plants={[]} /></div>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {frames.map((frame) => (
              <li key={frame.id} className="print:break-inside-avoid">
                <figure>
                  <div className="relative aspect-[3/4] overflow-hidden rounded-[var(--radius-md)] border border-line">
                    <Image src={frame.url} alt={frame.caption ?? `Día ${frame.day}`} fill sizes="(min-width: 640px) 25vw, 50vw" className="object-cover" />
                  </div>
                  <figcaption className="mt-1.5 text-xs text-fg-muted">
                    <span className="mono font-semibold text-fg">Día {frame.day}</span>
                    {frame.stage && ` · ${frame.stage}`} · {formatDay(frame.at)}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </section>
      )}

      {footer}
    </article>
  )
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="surface rounded-[var(--radius-lg)] p-4">
      <dt className="metric-label">{label}</dt>
      <dd className="metric mt-1.5 text-2xl text-fg">{value}</dd>
      {hint && <dd className="mt-0.5 text-xs text-fg-subtle">{hint}</dd>}
    </div>
  )
}
