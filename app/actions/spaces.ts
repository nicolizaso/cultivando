"use server";

import { createClient } from "@/app/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { Space } from "@/app/lib/types";

export async function updateSpace(id: number, data: Partial<Space>) {
  const supabase = await createClient();

  // Validate session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "No autorizado" };
  }

  // Exclude fields that shouldn't be manually updated or are read-only
  // cycleCount is likely a computed view or relation count, usually not a column to update.
  const { id: _id, cycleCount, ...updates } = data;

  try {
    const { error } = await supabase
      .from("spaces")
      .update(updates)
      .eq("id", id);

    if (error) {
      console.error("Error updating space:", error);
      return { success: false, error: "Error al actualizar el espacio" };
    }

    revalidatePath("/spaces");
    return { success: true };
  } catch (error) {
    console.error("Error in updateSpace:", error);
    return { success: false, error: "Error inesperado" };
  }
}

export async function createSpaceInline(name: string, type: 'Indoor' | 'Outdoor' | 'Mixto') {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "No autorizado" };
  }

  try {
    const { data, error } = await supabase
      .from("spaces")
      .insert({
        name,
        type,
        user_id: user.id
      })
      .select('id')
      .single();

    if (error) {
      console.error("Error creating space inline:", error);
      return { success: false, error: "Error al crear el espacio" };
    }

    revalidatePath("/spaces");
    return { success: true, spaceId: data.id };
  } catch (error) {
    console.error("Error in createSpaceInline:", error);
    return { success: false, error: "Error inesperado" };
  }
}
