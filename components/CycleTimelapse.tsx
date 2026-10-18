'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Film, Pause, Play } from 'lucide-react'
import type { TimelapseFrame } from '@/app/lib/timelapse'
import { formatDay } from '@/app/lib/dates'
import Modal from '@/components/ui/Modal'

/**
 * TIMELAPSE
 * ------------------------------------------------------------------
 * Pasa las fotos del ciclo en orden, con el día de cultivo y la etapa. Arranca
 * en pausa (nada se mueve solo sin pedirlo) y se maneja con botones, la barra
 * o el teclado: espacio reproduce o pausa, las flechas avanzan y retroceden.
 */

const SPEEDS = [
  { value: 2000, label: 'Lento' },
  { value: 900, label: 'Normal' },
  { value: 400, label: 'Rápido' },
] as const

interface CycleTimelapseProps {
  frames: TimelapseFrame[]
  /** Nombres de las plantas con fotos propias, para filtrar por planta. */
  plants: { id: number; name: string }[]
}

export default function CycleTimelapse({ frames, plants }: CycleTimelapseProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<number>(SPEEDS[1].value)
  const [plantFilter, setPlantFilter] = useState<string>('all')
  const sliderId = useId()

  const visible = useMemo(
    () => (plantFilter === 'all' ? frames : frames.filter((frame) => String(frame.plantId) === plantFilter)),
    [frames, plantFilter]
  )
  const current = visible[Math.min(index, visible.length - 1)]
  const atEnd = index >= visible.length - 1

  // Avanza un cuadro por intervalo; al llegar al último se detiene.
  useEffect(() => {
    if (!playing || !isOpen) return
    const timer = setTimeout(() => {
      if (atEnd) setPlaying(false)
      else setIndex((value) => value + 1)
    }, speed)
    return () => clearTimeout(timer)
  }, [playing, isOpen, index, speed, atEnd])

  const open = () => {
    setIndex(0)
    setPlaying(false)
    setIsOpen(true)
  }

  const close = () => {
    setPlaying(false)
    setIsOpen(false)
  }

  const togglePlay = () => {
    if (atEnd) setIndex(0)
    setPlaying((value) => !value || atEnd)
  }

  const step = (delta: number) => {
    setPlaying(false)
    setIndex((value) => Math.min(visible.length - 1, Math.max(0, value + delta)))
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if ((event.target as HTMLElement).tagName === 'SELECT') return
    if (event.key === ' ' && (event.target as HTMLElement).tagName !== 'BUTTON') {
      event.preventDefault()
      togglePlay()
    } else if (event.key === 'ArrowRight' && (event.target as HTMLElement).tagName !== 'INPUT') {
      step(1)
    } else if (event.key === 'ArrowLeft' && (event.target as HTMLElement).tagName !== 'INPUT') {
      step(-1)
    }
  }

  if (frames.length < 2) return null

  const next = visible[index + 1]

  return (
    <>
      <button type="button" onClick={open} className="btn btn-sm btn-ghost">
        <Film size={15} aria-hidden="true" />
        Timelapse
      </button>

      <Modal isOpen={isOpen} onClose={close} title="Timelapse del ciclo" size="xl">
        <div className="space-y-4" onKeyDown={onKeyDown}>
          {plants.length > 0 && (
            <div className="field max-w-xs">
              <label htmlFor={`${sliderId}-plant`} className="field-label">Fotos</label>
              <select
                id={`${sliderId}-plant`}
                className="field-input"
                value={plantFilter}
                onChange={(event) => {
                  setPlantFilter(event.target.value)
                  setIndex(0)
                  setPlaying(false)
                }}
              >
                <option value="all">Todo el ciclo</option>
                {plants.map((plant) => (
                  <option key={plant.id} value={plant.id}>{plant.name}</option>
                ))}
              </select>
            </div>
          )}

          {current ? (
            <figure>
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-lg)] bg-surface-2">
                <Image
                  key={current.id}
                  src={current.url}
                  alt={current.caption ? `${current.caption}, día ${current.day}` : `Día ${current.day} del ciclo`}
                  fill
                  sizes="(min-width: 1024px) 860px, 100vw"
                  className="object-contain"
                  priority
                />
                {/* El cuadro siguiente se carga de antemano para que no titile. */}
                {next && (
                  <Image src={next.url} alt="" fill sizes="(min-width: 1024px) 860px, 100vw" className="invisible object-contain" aria-hidden="true" />
                )}
              </div>
              <figcaption className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1" aria-live={playing ? 'off' : 'polite'}>
                <span className="text-base font-semibold text-fg">
                  Día {current.day}
                  {current.stage && <span className="ml-2 text-sm font-medium text-fg-muted">{current.stage}</span>}
                </span>
                <span className="text-sm text-fg-muted">
                  {current.caption ? `${current.caption} · ` : ''}{formatDay(current.at)}
                </span>
              </figcaption>
            </figure>
          ) : (
            <p className="py-10 text-center text-sm text-fg-muted">Esta planta no tiene fotos propias.</p>
          )}

          {visible.length > 1 && (
            <div className="space-y-3">
              <label htmlFor={sliderId} className="sr-only">Foto</label>
              <input
                id={sliderId}
                type="range"
                min={0}
                max={visible.length - 1}
                value={Math.min(index, visible.length - 1)}
                onChange={(event) => {
                  setPlaying(false)
                  setIndex(Number(event.target.value))
                }}
                aria-valuetext={current ? `Foto ${index + 1} de ${visible.length}, día ${current.day}` : undefined}
                className="w-full accent-[color:var(--brand)]"
              />

              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => step(-1)} disabled={index === 0} className="btn-icon" aria-label="Foto anterior">
                  <ChevronLeft size={18} aria-hidden="true" />
                </button>
                <button type="button" onClick={togglePlay} className="btn btn-primary btn-sm" aria-pressed={playing}>
                  {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
                  {playing ? 'Pausa' : atEnd ? 'Ver de nuevo' : 'Reproducir'}
                </button>
                <button type="button" onClick={() => step(1)} disabled={atEnd} className="btn-icon" aria-label="Foto siguiente">
                  <ChevronRight size={18} aria-hidden="true" />
                </button>

                <span className="mono ml-1 text-xs text-fg-muted">{Math.min(index, visible.length - 1) + 1} / {visible.length}</span>

                <div className="ml-auto flex items-center gap-2">
                  <label htmlFor={`${sliderId}-speed`} className="text-xs text-fg-muted">Velocidad</label>
                  <select
                    id={`${sliderId}-speed`}
                    className="field-input w-auto py-1.5 text-sm"
                    value={speed}
                    onChange={(event) => setSpeed(Number(event.target.value))}
                  >
                    {SPEEDS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
