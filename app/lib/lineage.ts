/**
 * LINAJE
 * ------------------------------------------------------------------
 * De qué planta salió cada esqueje y qué salió de cada madre. Cada planta
 * guarda su `mother_id`; acá se arma el árbol hacia arriba (sus ancestros) y
 * hacia abajo (sus esquejes, y los esquejes de esos esquejes). Puro.
 */

export interface LineagePlant {
  id: number;
  name: string;
  mother_id: number | null;
  stage?: string | null;
  is_archived?: boolean | null;
  is_mother?: boolean | null;
  planted_at?: string | null;
}

export interface LineageNode {
  plant: LineagePlant;
  /** 1 para los esquejes directos, 2 para los esquejes de esos, etc. */
  depth: number;
  children: LineageNode[];
}

/** Tope de generaciones: un dato roto (A madre de B y B madre de A) no cuelga la página. */
const MAX_DEPTH = 20;

function index(plants: LineagePlant[]) {
  const byId = new Map(plants.map((plant) => [Number(plant.id), plant]));
  const childrenOf = new Map<number, LineagePlant[]>();
  for (const plant of plants) {
    if (plant.mother_id == null) continue;
    const motherId = Number(plant.mother_id);
    childrenOf.set(motherId, [...(childrenOf.get(motherId) ?? []), plant]);
  }
  for (const list of childrenOf.values()) {
    list.sort((a, b) => String(a.planted_at ?? '').localeCompare(String(b.planted_at ?? '')) || a.name.localeCompare(b.name, 'es', { numeric: true }));
  }
  return { byId, childrenOf };
}

/** La cadena de madres, de la más cercana a la más lejana. */
export function ancestors(plantId: number, plants: LineagePlant[]): LineagePlant[] {
  const { byId } = index(plants);
  const chain: LineagePlant[] = [];
  const seen = new Set<number>([Number(plantId)]);
  let current = byId.get(Number(plantId));
  while (current?.mother_id != null && chain.length < MAX_DEPTH) {
    const motherId = Number(current.mother_id);
    if (seen.has(motherId)) break;
    seen.add(motherId);
    const mother = byId.get(motherId);
    if (!mother) break;
    chain.push(mother);
    current = mother;
  }
  return chain;
}

/** Los esquejes de la planta como árbol. */
export function descendants(plantId: number, plants: LineagePlant[]): LineageNode[] {
  const { childrenOf } = index(plants);
  const seen = new Set<number>([Number(plantId)]);

  const build = (id: number, depth: number): LineageNode[] => {
    if (depth > MAX_DEPTH) return [];
    return (childrenOf.get(id) ?? [])
      .filter((child) => !seen.has(Number(child.id)) && (seen.add(Number(child.id)), true))
      .map((child) => ({ plant: child, depth, children: build(Number(child.id), depth + 1) }));
  };

  return build(Number(plantId), 1);
}

export interface LineageStats {
  /** Esquejes directos. */
  clones: number;
  /** Esquejes directos que siguen activos. */
  activeClones: number;
  /** Toda la descendencia (esquejes de esquejes incluidos). */
  descendants: number;
  /** Generaciones por debajo (1 si sólo tiene esquejes directos). */
  generationsBelow: number;
  /** Generación de la planta: 0 si no tiene madre cargada, 1 si es esqueje de una, etc. */
  generation: number;
}

export function lineageStats(plantId: number, plants: LineagePlant[]): LineageStats {
  const tree = descendants(plantId, plants);
  let total = 0;
  let deepest = 0;
  const walk = (nodes: LineageNode[]) => {
    for (const node of nodes) {
      total++;
      deepest = Math.max(deepest, node.depth);
      walk(node.children);
    }
  };
  walk(tree);
  return {
    clones: tree.length,
    activeClones: tree.filter((node) => !node.plant.is_archived).length,
    descendants: total,
    generationsBelow: deepest,
    generation: ancestors(plantId, plants).length,
  };
}

/**
 * Las candidatas a madre ordenadas para un desplegable: primero las marcadas
 * como madre y después el resto, cada grupo por nombre.
 */
export function sortMotherOptions<T extends { name: string; is_mother?: boolean | null }>(plants: T[]): T[] {
  return [...plants].sort((a, b) => Number(Boolean(b.is_mother)) - Number(Boolean(a.is_mother)) || a.name.localeCompare(b.name, 'es', { numeric: true }));
}
