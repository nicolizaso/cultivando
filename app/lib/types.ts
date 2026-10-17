import type { Tables } from './database.types';
import type { DosageType, FertilizerStage, WeeklyDose } from './nutrition';

export type CycleStage = 
  | 'Germinación' 
  | 'Plántula'
  | 'Vegetativo' 
  | 'Enraizamiento'
  | 'Floración' 
  | 'Secado' 
  | 'Curado';

/*
 * Las filas de la base salen de los tipos generados (`database.types.ts`):
 * así un nombre de columna equivocado falla al compilar. Antes estos tipos se
 * escribían a mano y se habían separado de la base (Nutrición leía columnas
 * que no existían y nadie se enteraba hasta abrir la pantalla).
 */

/** Una planta tal como está en la base. */
export type Plant = Tables<'plants'>;

/** Un ciclo tal como está en la base. */
export type Cycle = Tables<'cycles'>;

export type SpaceType = 'Indoor' | 'Outdoor' | 'Mixto';

/** Un espacio tal como está en la base, más el recuento que arma la página. */
export type Space = Tables<'spaces'> & { cycleCount?: number };

/** Una medición de clima. */
export type Measurement = Tables<'measurements'>;

/** Una tarea, con los ciclos que arma la página para filtrar y mostrar. */
export interface Task {
  id: number | string;
  title: string;
  due_date: string; // ISO string YYYY-MM-DD
  completed?: boolean;
  status?: 'pending' | 'completed';
  completed_at?: string;
  cycleId?: string;
  cycleIds?: number[];
  cycleName?: string; // Deprecated
  cycleNames?: string;
  type: string; // 'riego', 'poda', etc.
  application_type?: string;
  target_stage?: string;
  target_space_id?: number | null;
  description?: string;
  metadata?: TaskMetadata | null;
  recurrence_id?: string;
  task_plants?: {
    plant_id?: number;
    plants?: {
      id?: number;
      name?: string;
      cycle_id?: number;
      cycles?: { id: number; name: string; };
    };
  }[];
  task_cycles?: {
    cycles?: { id: number; name: string; };
  }[];
  plants?: any;
}

/**
 * Resultado de una tarea de esquejado: se escribe al completarla y es lo que
 * hace que volver a completarla no duplique plantas.
 */
export interface EsquejadoMetadata {
  date: string;
  /** Null cuando la tarea se completó sin registrar ningún esqueje. */
  target_cycle_id: number | null;
  total: number;
  registered_at: string;
  entries: { mother_id: number; mother_name?: string; count: number; plant_ids: number[] }[];
}

export interface TaskMetadata {
  esquejado?: EsquejadoMetadata;
  [key: string]: unknown;
}

/** Un registro de la bitácora. */
export type Log = Tables<'logs'>;

/** Una foto de la galería de un ciclo. */
export type CycleImage = Tables<'cycle_images'>;

/** Un fertilizante, con los nombres reales de las columnas de `fertilizers`. */
export interface Fertilizer {
  id: number;
  user_id: string | null;
  name: string;
  brand: string | null;
  stage_category: FertilizerStage | null;
  dosage_type: DosageType | null;
  /** ml por litro, cuando la dosis es fija. */
  fixed_dosage: number | null;
  /** Tabla por semana de la etapa, cuando la dosis es semanal. */
  weekly_dosages: WeeklyDose[] | null;
  created_at: string | null;
}

/** Un combo: varios productos que se aplican en el mismo riego. */
export interface FertilizerCombo {
  id: number;
  user_id: string | null;
  name: string;
  description: string | null;
  /** Sale de `combo_items`; no es una columna de la tabla. */
  products: { fertilizer_id: number; name: string }[];
  created_at: string | null;
}
