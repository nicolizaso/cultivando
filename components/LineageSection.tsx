import Link from 'next/link'
import { ChevronRight, GitBranch } from 'lucide-react'
import type { LineageNode, LineagePlant, LineageStats } from '@/app/lib/lineage'
import { getStageColor } from '@/app/lib/utils'

/**
 * Linaje de una planta en su ficha: de quién viene y qué salió de ella. Se
 * dibuja en el servidor (no tiene estado): es una lista anidada con enlaces.
 */

interface LineageSectionProps {
  plant: LineagePlant
  ancestors: LineagePlant[]
  tree: LineageNode[]
  stats: LineageStats
}

const MAX_SHOWN = 60

export default function LineageSection({ plant, ancestors, tree, stats }: LineageSectionProps) {
  if (ancestors.length === 0 && tree.length === 0 && !plant.is_mother) return null

  let shown = 0
  const renderNodes = (nodes: LineageNode[]) => (
    <ul className={nodes[0]?.depth > 1 ? 'ml-4 mt-1 space-y-1 border-l border-line pl-3' : 'space-y-1'}>
      {nodes.map((node) => {
        if (shown >= MAX_SHOWN) return null
        shown++
        const stage = getStageColor(node.plant.stage)
        return (
          <li key={node.plant.id}>
            <Link
              href={`/plants/${node.plant.id}`}
              className="flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-sm transition-colors hover:bg-surface-2"
            >
              <span className={`font-medium ${node.plant.is_archived ? 'text-fg-muted line-through decoration-1' : 'text-fg'}`}>
                {node.plant.name}
              </span>
              {node.plant.is_mother && <span className="chip chip-brand">Madre</span>}
              <span className={`chip ${stage.bgColor} ${stage.textColor} ${stage.borderColor}`}>{node.plant.stage ?? 'Sin etapa'}</span>
              {node.plant.is_archived && <span className="text-xs text-fg-subtle">archivada</span>}
            </Link>
            {node.children.length > 0 && renderNodes(node.children)}
          </li>
        )
      })}
    </ul>
  )

  return (
    <section aria-labelledby="linaje" className="mx-auto mb-10 max-w-3xl">
      <div className="mb-4 flex items-center gap-2.5 border-b border-line pb-4">
        <GitBranch className="text-[color:var(--brand-text)]" size={18} aria-hidden="true" />
        <h2 id="linaje" className="section-title">Linaje</h2>
      </div>

      {ancestors.length > 0 && (
        <nav aria-label="De dónde viene" className="mb-5">
          <p className="metric-label mb-2">Viene de</p>
          <ol className="flex flex-wrap items-center gap-1.5 text-sm">
            {[...ancestors].reverse().map((mother) => (
              <li key={mother.id} className="flex items-center gap-1.5">
                <Link href={`/plants/${mother.id}`} className="font-medium text-[color:var(--brand-text)] hover:underline">
                  {mother.name}
                </Link>
                <ChevronRight size={14} className="text-fg-subtle" aria-hidden="true" />
              </li>
            ))}
            <li className="font-semibold text-fg" aria-current="page">{plant.name}</li>
          </ol>
          <p className="mt-1.5 text-xs text-fg-muted">
            {stats.generation === 1 ? 'Primera generación de esquejes' : `Generación ${stats.generation} de esquejes`}
          </p>
        </nav>
      )}

      {tree.length > 0 ? (
        <div>
          <p className="metric-label mb-2">
            Sus esquejes · {stats.clones} {stats.clones === 1 ? 'directo' : 'directos'} ({stats.activeClones} {stats.activeClones === 1 ? 'activo' : 'activos'})
            {stats.descendants > stats.clones && ` · ${stats.descendants} en total, ${stats.generationsBelow} generaciones`}
          </p>
          {renderNodes(tree)}
          {stats.descendants > MAX_SHOWN && (
            <p className="mt-2 text-xs text-fg-muted">Se muestran {MAX_SHOWN} de {stats.descendants}.</p>
          )}
        </div>
      ) : plant.is_mother ? (
        <p className="text-sm text-fg-muted">Es planta madre, pero todavía no tiene esquejes registrados.</p>
      ) : null}
    </section>
  )
}
