'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { BarChart3, Table2 } from 'lucide-react'
import type { ClimatePoint, StageClimate, StageClimateStats, VpdRange } from '@/app/lib/climate'
import { vpdLevel } from '@/app/lib/climate'
import { daysBetweenKeys, formatInAppTz } from '@/app/lib/dates'
import SegmentedControl from '@/components/ui/SegmentedControl'

/**
 * HISTORIAL DE CLIMA
 * ------------------------------------------------------------------
 * Temperatura, humedad y VPD tienen escalas distintas, así que van en tres
 * paneles chicos con el mismo eje de fechas (nunca dos ejes en un gráfico).
 * Cada panel muestra la franja del rango sano para la etapa del ciclo.
 *
 * El cursor está sincronizado: al apuntar un día se ven los tres valores de
 * ese día en un único cartel. Con el teclado, las flechas mueven el cursor.
 * Todo lo que dice el cartel también está en la vista de tabla.
 */

type View = 'chart' | 'table'
type MetricKey = 'temperature' | 'humidity' | 'vpd'

interface Metric {
  key: MetricKey
  label: string
  unit: string
  decimals: number
  range: VpdRange | null
}

interface ClimateHistoryProps {
  points: ClimatePoint[]
  /** La etapa del ciclo, para el rango sano. */
  stageLabel: string | null
  climate: StageClimate | null
  /** El clima de cada etapa por la que pasó el ciclo. */
  byStage: StageClimateStats[]
}

const PLOT_HEIGHT = 96
/** Alto del renglón con el nombre del panel, arriba del área de datos. */
const PANEL_TITLE = 18
const PANEL_GAP = 16
const MARGIN = { top: 8, right: 16, bottom: 0, left: 40 }
const AXIS_HEIGHT = 24

const number = (value: number | null, decimals: number) =>
  value === null ? '–' : value.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

const shortDay = (day: string) => formatInAppTz(day, { day: 'numeric', month: 'short' })

const LEVEL_LABEL = { low: 'Bajo', ok: 'En rango', high: 'Alto', unknown: '' } as const

/** Tres valores redondos que cubren el dominio, para las marcas del eje. */
function niceTicks(min: number, max: number): number[] {
  const span = max - min || 1
  const raw = span / 2
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw
  const start = Math.ceil(min / step) * step
  const ticks: number[] = []
  for (let value = start; value <= max + step * 1e-9; value += step) ticks.push(Math.round(value * 1000) / 1000)
  return ticks
}

/** Dominio del panel: los datos y la franja, con un poco de aire. */
function domainFor(values: number[], range: VpdRange | null): [number, number] {
  const all = range ? [...values, range.min, range.max] : values
  if (all.length === 0) return [0, 1]
  let min = Math.min(...all)
  let max = Math.max(...all)
  if (min === max) {
    min -= 1
    max += 1
  }
  const pad = (max - min) * 0.12
  return [min - pad, max + pad]
}

/** Ancho del contenedor, para dibujar el SVG a su medida y no estirarlo. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

export default function ClimateHistory({ points, stageLabel, climate, byStage }: ClimateHistoryProps) {
  const [view, setView] = useState<View>('chart')
  const [active, setActive] = useState<number | null>(null)
  const [containerRef, width] = useWidth<HTMLDivElement>()
  const titleId = useId()

  const metrics: Metric[] = useMemo(() => [
    { key: 'temperature', label: 'Temperatura', unit: '°C', decimals: 1, range: climate?.temperature ?? null },
    { key: 'humidity', label: 'Humedad', unit: '%', decimals: 0, range: climate?.humidity ?? null },
    { key: 'vpd', label: 'VPD', unit: 'kPa', decimals: 2, range: climate?.vpd ?? null },
  ], [climate])

  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
  const first = points[0]?.day
  const totalDays = first ? Math.max(1, daysBetweenKeys(first, points[points.length - 1].day)) : 1
  const xOf = (day: string) => MARGIN.left + (first ? (daysBetweenKeys(first, day) / totalDays) * plotWidth : 0)

  const nearestIndex = (clientX: number, rect: DOMRect) => {
    const x = clientX - rect.left
    let best = 0
    let bestDistance = Infinity
    points.forEach((point, index) => {
      const distance = Math.abs(xOf(point.day) - x)
      if (distance < bestDistance) {
        best = index
        bestDistance = distance
      }
    })
    return best
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (points.length === 0) return
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const delta = event.key === 'ArrowRight' ? 1 : -1
      setActive((current) => Math.min(points.length - 1, Math.max(0, (current ?? points.length - 1) + (current === null ? 0 : delta))))
    } else if (event.key === 'Home') {
      setActive(0)
    } else if (event.key === 'End') {
      setActive(points.length - 1)
    } else if (event.key === 'Escape') {
      setActive(null)
    }
  }

  const panelTop = (index: number) => MARGIN.top + index * (PANEL_TITLE + PLOT_HEIGHT + PANEL_GAP) + PANEL_TITLE
  const totalHeight = panelTop(metrics.length - 1) + PLOT_HEIGHT + AXIS_HEIGHT
  const activePoint = active === null ? null : points[active]

  // Marcas del eje de fechas: el primer día, el último y hasta tres en el medio.
  const xTicks = useMemo(() => {
    // En un celular entran tres fechas sin pisarse; en pantalla grande, cinco.
    const fractions = plotWidth < 420 ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1]
    if (points.length <= fractions.length) return points.map((point) => point.day)
    const picks = fractions.map((f) => points[Math.round(f * (points.length - 1))].day)
    return Array.from(new Set(picks))
  }, [points, plotWidth])

  return (
    <div className="surface rounded-[var(--radius-lg)] p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={titleId} className="text-sm font-semibold text-fg">Historial</h3>
          <p className="mt-0.5 text-xs text-fg-muted">
            {points.length} {points.length === 1 ? 'día' : 'días'} con medición
            {stageLabel && climate ? ` · la franja es el rango sano para ${stageLabel}` : ''}
          </p>
        </div>
        <SegmentedControl<View>
          className="print:hidden"
          label="Cómo ver el historial"
          value={view}
          onChange={setView}
          iconOnly
          options={[
            { value: 'chart', label: 'Gráfico', icon: BarChart3, srLabel: 'Ver gráfico' },
            { value: 'table', label: 'Tabla', icon: Table2, srLabel: 'Ver tabla' },
          ]}
        />
      </div>

      {points.length < 2 && view === 'chart' ? (
        <p className="py-6 text-center text-sm text-fg-muted">
          Con mediciones de dos días o más aparece el gráfico.
        </p>
      ) : view === 'chart' ? (
        <div
          ref={containerRef}
          className="relative outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] rounded-[var(--radius-md)]"
          tabIndex={0}
          role="group"
          aria-labelledby={titleId}
          aria-describedby={`${titleId}-hint`}
          onKeyDown={onKeyDown}
          onPointerMove={(event) => setActive(nearestIndex(event.clientX, event.currentTarget.getBoundingClientRect()))}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
        >
          <p id={`${titleId}-hint`} className="sr-only">
            Usá las flechas para recorrer los días. Los mismos datos están en la vista de tabla.
          </p>

          {width > 0 && (
            <svg width={width} height={totalHeight} role="img" aria-label="Temperatura, humedad y VPD por día">
              {metrics.map((metric, panelIndex) => {
                const values = points.map((point) => point[metric.key]).filter((v): v is number => v !== null)
                const [min, max] = domainFor(values, metric.range)
                const top = panelTop(panelIndex)
                const yOf = (value: number) => top + PLOT_HEIGHT - ((value - min) / (max - min)) * PLOT_HEIGHT

                // Un día sin dato corta la línea en vez de inventar un tramo.
                let path = ''
                let drawing = false
                points.forEach((point) => {
                  const value = point[metric.key]
                  if (value === null) {
                    drawing = false
                    return
                  }
                  path += `${drawing ? 'L' : 'M'}${xOf(point.day).toFixed(1)},${yOf(value).toFixed(1)}`
                  drawing = true
                })

                const lastWithValue = [...points].reverse().find((point) => point[metric.key] !== null)
                const activeValue = activePoint ? activePoint[metric.key] : null

                return (
                  <g key={metric.key}>
                    {/* Franja del rango sano */}
                    {metric.range && (
                      <rect
                        x={MARGIN.left}
                        width={plotWidth}
                        y={yOf(Math.min(max, metric.range.max))}
                        height={Math.max(0, yOf(Math.max(min, metric.range.min)) - yOf(Math.min(max, metric.range.max)))}
                        fill="var(--chart-band)"
                      />
                    )}

                    {/* Grilla y marcas del eje */}
                    {niceTicks(min, max).map((tick) => (
                      <g key={tick}>
                        <line x1={MARGIN.left} x2={MARGIN.left + plotWidth} y1={yOf(tick)} y2={yOf(tick)} stroke="var(--border)" strokeWidth={1} />
                        <text
                          x={MARGIN.left - 6}
                          y={yOf(tick)}
                          dy="0.32em"
                          textAnchor="end"
                          fontSize={11}
                          fill="var(--fg-muted)"
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {number(tick, metric.decimals === 2 ? 1 : 0)}
                        </text>
                      </g>
                    ))}

                    {/* Nombre del panel: arriba a la izquierda, en tinta de texto */}
                    <text x={MARGIN.left} y={top - 7} fontSize={11} fontWeight={600} fill="var(--fg-muted)">
                      {metric.label} ({metric.unit})
                    </text>

                    <path d={path} fill="none" stroke="var(--chart-line)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

                    {/* El último valor, marcado y rotulado */}
                    {lastWithValue && activePoint === null && (
                      <>
                        <circle
                          cx={xOf(lastWithValue.day)}
                          cy={yOf(lastWithValue[metric.key] as number)}
                          r={4}
                          fill="var(--chart-line)"
                          stroke="var(--surface)"
                          strokeWidth={2}
                        />
                        <text
                          x={xOf(lastWithValue.day) - 8}
                          y={yOf(lastWithValue[metric.key] as number) - 9}
                          textAnchor="end"
                          fontSize={11}
                          fontWeight={600}
                          fill="var(--fg)"
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {number(lastWithValue[metric.key], metric.decimals)}
                        </text>
                      </>
                    )}

                    {activePoint && activeValue !== null && (
                      <circle
                        cx={xOf(activePoint.day)}
                        cy={yOf(activeValue)}
                        r={4}
                        fill="var(--chart-line)"
                        stroke="var(--surface)"
                        strokeWidth={2}
                      />
                    )}
                  </g>
                )
              })}

              {/* Cursor: una línea fina que atraviesa los tres paneles */}
              {activePoint && (
                <line
                  x1={xOf(activePoint.day)}
                  x2={xOf(activePoint.day)}
                  y1={panelTop(0)}
                  y2={totalHeight - AXIS_HEIGHT}
                  stroke="var(--fg-muted)"
                  strokeWidth={1}
                />
              )}

              {/* Eje de fechas, una sola vez abajo */}
              {xTicks.map((day, index) => (
                <text
                  key={day}
                  x={xOf(day)}
                  y={totalHeight - 6}
                  textAnchor={index === 0 ? 'start' : index === xTicks.length - 1 ? 'end' : 'middle'}
                  fontSize={11}
                  fill="var(--fg-muted)"
                >
                  {shortDay(day)}
                </text>
              ))}
            </svg>
          )}

          {activePoint && (
            <div
              className="pointer-events-none absolute top-0 z-10 w-max rounded-[var(--radius-md)] border border-line bg-surface p-3 text-xs shadow-[var(--shadow-lg)]"
              style={
                // En pantallas angostas no entra al costado del cursor: va centrado.
                width < 480
                  ? { left: '50%', transform: 'translateX(-50%)' }
                  : xOf(activePoint.day) > width / 2
                    ? { right: width - xOf(activePoint.day) + 12 }
                    : { left: xOf(activePoint.day) + 12 }
              }
              aria-live="polite"
            >
              <p className="mb-2 font-semibold text-fg">{formatInAppTz(activePoint.day, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
              <ul className="space-y-1.5">
                {metrics.map((metric) => {
                  const value = activePoint[metric.key]
                  const level = metric.range && value !== null ? vpdLevel(value, metric.range) : 'unknown'
                  return (
                    <li key={metric.key} className="flex items-center gap-2">
                      <span className="h-0.5 w-3 shrink-0 rounded-full bg-[color:var(--chart-line)]" aria-hidden="true" />
                      <span className="mono whitespace-nowrap font-semibold text-fg">
                        {number(value, metric.decimals)} {value !== null && metric.unit}
                      </span>
                      <span className="text-fg-muted">{metric.label}</span>
                      {level !== 'unknown' && <span className="ml-auto whitespace-nowrap pl-2 text-fg-muted">{LEVEL_LABEL[level]}</span>}
                    </li>
                  )
                })}
              </ul>
              {activePoint.count > 1 && (
                <p className="mt-2 text-fg-subtle">Promedio de {activePoint.count} mediciones</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <ClimateTable points={points} metrics={metrics} />
      )}

      {byStage.length > 0 && <StageTable stats={byStage} />}
    </div>
  )
}

function ClimateTable({ points, metrics }: { points: ClimatePoint[]; metrics: Metric[] }) {
  if (points.length === 0) {
    return <p className="py-6 text-center text-sm text-fg-muted">Todavía no hay mediciones.</p>
  }
  return (
    <div className="custom-scrollbar max-h-80 overflow-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Clima por día, del más nuevo al más viejo</caption>
        <thead className="sticky top-0 bg-surface text-left text-xs text-fg-muted">
          <tr>
            <th scope="col" className="py-2 pr-3 font-semibold">Día</th>
            {metrics.map((metric) => (
              <th key={metric.key} scope="col" className="py-2 pr-3 text-right font-semibold">
                {metric.label} ({metric.unit})
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...points].reverse().map((point) => (
            <tr key={point.day} className="border-t border-line">
              <th scope="row" className="py-2 pr-3 text-left font-medium text-fg">
                {formatInAppTz(point.day, { day: '2-digit', month: '2-digit', year: '2-digit' })}
              </th>
              {metrics.map((metric) => {
                const value = point[metric.key]
                const level = metric.range && value !== null ? vpdLevel(value, metric.range) : 'unknown'
                return (
                  <td key={metric.key} className="mono py-2 pr-3 text-right text-fg">
                    {number(value, metric.decimals)}
                    {level !== 'unknown' && level !== 'ok' && (
                      <span className="ml-1.5 text-xs text-fg-muted">{LEVEL_LABEL[level]}</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** VPD por etapa: cuánto tiempo estuvo el clima dentro del rango de cada una. */
function StageTable({ stats }: { stats: StageClimateStats[] }) {
  return (
    <div className="mt-6 border-t border-line pt-4">
      <h3 className="text-sm font-semibold text-fg">VPD por etapa</h3>
      <p className="mt-0.5 text-xs text-fg-muted">Promedios de los días medidos en cada etapa del ciclo.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-fg-muted">
            <tr>
              <th scope="col" className="py-2 pr-3 font-semibold">Etapa</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">Días</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">Temp.</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">Hum.</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">VPD</th>
              <th scope="col" className="py-2 text-right font-semibold">En rango</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((row) => (
              <tr key={row.stage} className="border-t border-line">
                <th scope="row" className="py-2 pr-3 text-left font-medium text-fg">{row.stage}</th>
                <td className="mono py-2 pr-3 text-right text-fg">{row.days}</td>
                <td className="mono py-2 pr-3 text-right text-fg">{number(row.avgTemperature, 1)}°</td>
                <td className="mono py-2 pr-3 text-right text-fg">{number(row.avgHumidity, 0)}%</td>
                <td className="mono py-2 pr-3 text-right text-fg">{number(row.avgVpd, 2)}</td>
                <td className="mono py-2 text-right text-fg">
                  {row.inRange === null ? '–' : `${Math.round(row.inRange * 100)}%`}
                  {row.range && (
                    <span className="ml-1.5 hidden text-xs text-fg-subtle sm:inline">
                      ({number(row.range.min, 1)}–{number(row.range.max, 1)})
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
