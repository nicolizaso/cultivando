"use server";

import { createClient } from "@/app/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function createPlantsBulk(
  count: number,
  strain: string,
  sourceType: 'Semilla' | 'Esqueje',
  cycleId: number
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "No autorizado" };
  }

  try {
    const plantsData = Array.from({ length: count }).map((_, index) => ({
      name: `${strain} #${index + 1}`,
      strain: strain,
      source_type: sourceType,
      cycle_id: cycleId,
      user_id: user.id,
      stage: 'Germinación', // Default starting stage
      planted_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from("plants")
      .insert(plantsData)
      .select('id');

    if (error) {
      console.error("Error creating plants bulk:", error);
      return { success: false, error: "Error al crear las plantas" };
    }

    revalidatePath("/plants");
    revalidatePath(`/cycles/${cycleId}`);
    return { success: true, plantIds: data.map(p => p.id) };
  } catch (error) {
    console.error("Error in createPlantsBulk:", error);
    return { success: false, error: "Error inesperado" };
  }
}
