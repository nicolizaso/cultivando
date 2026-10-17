// Tipos generados desde la base de Supabase (proyecto Cultivapp, esquema public).
// Se regeneran cuando cambia el esquema. Mientras las migraciones de este PR no
// estén aplicadas, describen la base como queda DESPUÉS de aplicarlas (se
// ajustaron a mano para eso); al aplicarlas, regenerarlos debería dar lo mismo.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      combo_items: {
        Row: {
          combo_id: number
          fertilizer_id: number
        }
        Insert: {
          combo_id: number
          fertilizer_id: number
        }
        Update: {
          combo_id?: number
          fertilizer_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "combo_items_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "fertilizer_combos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_items_fertilizer_id_fkey"
            columns: ["fertilizer_id"]
            isOneToOne: false
            referencedRelation: "fertilizers"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_images: {
        Row: {
          created_at: string | null
          cycle_id: number
          description: string | null
          id: string
          public_url: string
          storage_path: string | null
          taken_at: string | null
        }
        Insert: {
          created_at?: string | null
          cycle_id: number
          description?: string | null
          id?: string
          public_url: string
          storage_path?: string | null
          taken_at?: string | null
        }
        Update: {
          created_at?: string | null
          cycle_id?: number
          description?: string | null
          id?: string
          public_url?: string
          storage_path?: string | null
          taken_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cycle_images_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      cycles: {
        Row: {
          created_at: string | null
          estimated_harvest: string | null
          id: number
          is_active: boolean | null
          name: string
          space_id: number | null
          start_date: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          estimated_harvest?: string | null
          id?: never
          is_active?: boolean | null
          name: string
          space_id?: number | null
          start_date?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          estimated_harvest?: string | null
          id?: never
          is_active?: boolean | null
          name?: string
          space_id?: number | null
          start_date?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cycles_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      fertilizer_combos: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      fertilizers: {
        Row: {
          brand: string | null
          created_at: string | null
          dosage_type: string | null
          fixed_dosage: number | null
          id: number
          name: string
          stage_category: string | null
          user_id: string | null
          weekly_dosages: Json | null
        }
        Insert: {
          brand?: string | null
          created_at?: string | null
          dosage_type?: string | null
          fixed_dosage?: number | null
          id?: number
          name: string
          stage_category?: string | null
          user_id?: string | null
          weekly_dosages?: Json | null
        }
        Update: {
          brand?: string | null
          created_at?: string | null
          dosage_type?: string | null
          fixed_dosage?: number | null
          id?: number
          name?: string
          stage_category?: string | null
          user_id?: string | null
          weekly_dosages?: Json | null
        }
        Relationships: []
      }
      logs: {
        Row: {
          created_at: string | null
          cycle_id: number | null
          data: Json | null
          id: number
          media_url: string[] | null
          notes: string | null
          plant_id: number | null
          title: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          cycle_id?: number | null
          data?: Json | null
          id?: never
          media_url?: string[] | null
          notes?: string | null
          plant_id?: number | null
          title?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          cycle_id?: number | null
          data?: Json | null
          id?: never
          media_url?: string[] | null
          notes?: string | null
          plant_id?: number | null
          title?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      measurements: {
        Row: {
          created_at: string | null
          cycle_id: number | null
          date: string
          humidity: number | null
          id: number
          temperature: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          cycle_id?: number | null
          date?: string
          humidity?: number | null
          id?: number
          temperature?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          cycle_id?: number | null
          date?: string
          humidity?: number | null
          id?: number
          temperature?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "measurements_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      plants: {
        Row: {
          breeder: string | null
          created_at: string | null
          cycle_id: number | null
          date_curado: string | null
          date_enraizamiento: string | null
          date_floracion: string | null
          date_germinacion: string | null
          date_plantula: string | null
          date_secado: string | null
          date_vegetativo: string | null
          id: number
          image_url: string | null
          is_archived: boolean | null
          last_water: string | null
          mother_id: number | null
          name: string
          planted_at: string | null
          source_type: string | null
          stage: string | null
          stage_updated_at: string | null
          strain: string | null
          user_id: string | null
        }
        Insert: {
          breeder?: string | null
          created_at?: string | null
          cycle_id?: number | null
          date_curado?: string | null
          date_enraizamiento?: string | null
          date_floracion?: string | null
          date_germinacion?: string | null
          date_plantula?: string | null
          date_secado?: string | null
          date_vegetativo?: string | null
          id?: never
          image_url?: string | null
          is_archived?: boolean | null
          last_water?: string | null
          mother_id?: number | null
          name: string
          planted_at?: string | null
          source_type?: string | null
          stage?: string | null
          stage_updated_at?: string | null
          strain?: string | null
          user_id?: string | null
        }
        Update: {
          breeder?: string | null
          created_at?: string | null
          cycle_id?: number | null
          date_curado?: string | null
          date_enraizamiento?: string | null
          date_floracion?: string | null
          date_germinacion?: string | null
          date_plantula?: string | null
          date_secado?: string | null
          date_vegetativo?: string | null
          id?: never
          image_url?: string | null
          is_archived?: boolean | null
          last_water?: string | null
          mother_id?: number | null
          name?: string
          planted_at?: string | null
          source_type?: string | null
          stage?: string | null
          stage_updated_at?: string | null
          strain?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plants_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plants_mother_id_fkey"
            columns: ["mother_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          username?: string | null
        }
        Relationships: []
      }
      spaces: {
        Row: {
          area_m2: number | null
          created_at: string | null
          height: number | null
          id: number
          length: number | null
          light_brand_model: string | null
          light_ppfd: number | null
          light_type: string | null
          light_watts: number | null
          name: string
          pot_capacity: number | null
          type: string | null
          user_id: string | null
          vent_extra_equipment: string | null
          vent_extraction: number | null
          vent_filter_brand: string | null
          vent_intraction: number | null
          width: number | null
        }
        Insert: {
          area_m2?: number | null
          created_at?: string | null
          height?: number | null
          id?: never
          length?: number | null
          light_brand_model?: string | null
          light_ppfd?: number | null
          light_type?: string | null
          light_watts?: number | null
          name: string
          pot_capacity?: number | null
          type?: string | null
          user_id?: string | null
          vent_extra_equipment?: string | null
          vent_extraction?: number | null
          vent_filter_brand?: string | null
          vent_intraction?: number | null
          width?: number | null
        }
        Update: {
          area_m2?: number | null
          created_at?: string | null
          height?: number | null
          id?: never
          length?: number | null
          light_brand_model?: string | null
          light_ppfd?: number | null
          light_type?: string | null
          light_watts?: number | null
          name?: string
          pot_capacity?: number | null
          type?: string | null
          user_id?: string | null
          vent_extra_equipment?: string | null
          vent_extraction?: number | null
          vent_filter_brand?: string | null
          vent_intraction?: number | null
          width?: number | null
        }
        Relationships: []
      }
      task_cycles: {
        Row: {
          cycle_id: number
          task_id: number
        }
        Insert: {
          cycle_id: number
          task_id: number
        }
        Update: {
          cycle_id?: number
          task_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "task_cycles_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_cycles_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_plants: {
        Row: {
          plant_id: number
          task_id: number
        }
        Insert: {
          plant_id: number
          task_id: number
        }
        Update: {
          plant_id?: number
          task_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "task_plants_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_plants_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          application_type: string | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string
          id: number
          metadata: Json | null
          recurrence_id: string | null
          status: string
          target_space_id: number | null
          target_stage: string | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          application_type?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date: string
          id?: never
          metadata?: Json | null
          recurrence_id?: string | null
          status?: string
          target_space_id?: number | null
          target_stage?: string | null
          title: string
          type?: string | null
          user_id?: string
        }
        Update: {
          application_type?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string
          id?: never
          metadata?: Json | null
          recurrence_id?: string | null
          status?: string
          target_space_id?: number | null
          target_stage?: string | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_target_space_id_fkey"
            columns: ["target_space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_esquejado: {
        Args: {
          p_task_id: number
          p_seeds: Json
          p_summary: Json
          p_new_cycle: Json | null
        }
        Returns: Json
      }
      create_tasks: {
        Args: { p_tasks: Json; p_cycle_ids: number[]; p_plant_ids: number[] }
        Returns: number[]
      }
      email_for_username: { Args: { p_username: string }; Returns: string }
      save_fertilizer_combo: {
        Args: {
          p_combo_id: number | null
          p_name: string
          p_description: string | null
          p_fertilizer_ids: number[]
        }
        Returns: number
      }
      update_task_series: {
        Args: {
          p_task_id: number
          p_title: string
          p_description: string | null
          p_application_type: string | null
          p_target_stage: string | null
          p_new_day: string
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
