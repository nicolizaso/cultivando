export type CycleStage = 
  | 'Germinación' 
  | 'Plántula'
  | 'Vegetativo' 
  | 'Enraizamiento'
  | 'Floración' 
  | 'Secado' 
  | 'Curado';

export interface Plant {
  id: number;
  name: string;
  stage: string;
  days?: number; // Deprecated: Use current_age_days instead
  planted_at?: string; // ISO timestamp
  stage_updated_at?: string; // ISO timestamp
  current_age_days?: number; // Computed field
  days_in_stage?: number; // Computed field
  last_water: string;
  cycle_id: number | null;
  image_url?: string;
  strain?: string;
  breeder?: string;
  source_type?: 'Semilla' | 'Esqueje';
  mother_id?: number | null;
  date_germinacion?: string;
  date_plantula?: string;
  date_enraizamiento?: string;
  date_vegetativo?: string;
  date_floracion?: string;
  date_secado?: string;
  date_curado?: string;
  is_archived?: boolean;
}

export interface Cycle {
  id: number;
  name: string;
  start_date: string;
  is_active: boolean;
  space_id: number;
  stage?: CycleStage; // Opcional por si no lo usas aún
}

export interface Space {
  id: number;
  name: string;
  type: 'Indoor' | 'Outdoor' | 'Mixto';
  cycleCount?: number;
  width?: number;
  length?: number;
  height?: number;
  area_m2?: number;
  light_type?: string;
  light_brand_model?: string;
  light_watts?: number;
  light_ppfd?: number;
  vent_extraction?: number;
  vent_intraction?: number;
  vent_filter_brand?: string;
  vent_extra_equipment?: string;
  pot_capacity?: number;
}

// ESTA ES LA INTERFAZ QUE FALTABA:
export interface Task {
  id: number | string;
  title: string;
  due_date: string; // ISO string YYYY-MM-DD
  completed?: boolean;
  status?: 'pending' | 'completed';
  completed_at?: string;
  cycle_id?: number; // Deprecated
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

export interface Log {
  id: number;
  plant_id: number | null;
  cycle_id?: number | null;
  type: string;
  title: string;
  notes?: string;
  media_url?: string[];
  created_at: string;
}

export interface CycleImage {
  id: string;
  cycle_id: number;
  storage_path: string;
  public_url: string;
  taken_at: string; // ISO Timestamp
  created_at: string; // ISO Timestamp
  description?: string;
}

export interface Fertilizer {
  id: number;
  user_id: string;
  name: string;
  brand: string;
  stage: 'enraizamiento' | 'vegetativo' | 'floracion' | 'lavado' | 'todo';
  dose_type: 'fija' | 'semanal';
  dose_fixed?: number | null;
  dose_weekly?: { week: number; dose: number }[] | null;
  created_at: string;
}

export interface FertilizerCombo {
  id: number;
  user_id: string;
  name: string;
  products: { fertilizer_id: number; name: string }[];
  created_at: string;
}
