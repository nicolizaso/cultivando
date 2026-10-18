"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/app/lib/auth";
import { friendlyDbError } from "@/app/lib/errors";
import { nullable, oneOf, optionalNumber, optionalText, parseId, pickFields, requiredText } from "@/app/lib/sanitize";

const SPACE_TYPES = ['Indoor', 'Outdoor', 'Mixto'] as const;

/**
 * Lo único que se puede editar de un espacio: su nombre, su tipo y la ficha
 * técnica. `user_id`, `id` o cualquier otra columna que llegue se ignora.
 */
const SPACE_FIELDS = {
  name: requiredText(80),
  type: nullable(oneOf(SPACE_TYPES)),
  width: optionalNumber({ min: 0, max: 1000 }),
  length: optionalNumber({ min: 0, max: 1000 }),
  height: optionalNumber({ min: 0, max: 1000 }),
  area_m2: optionalNumber({ min: 0, max: 100000 }),
  light_type: optionalText(80),
  light_brand_model: optionalText(120),
  light_watts: optionalNumber({ min: 0, max: 100000, integer: true }),
  light_ppfd: optionalNumber({ min: 0, max: 5000, integer: true }),
  vent_extraction: optionalNumber({ min: 0, max: 100000, integer: true }),
  vent_intraction: optionalNumber({ min: 0, max: 100000, integer: true }),
  vent_filter_brand: optionalText(120),
  vent_extra_equipment: optionalText(500),
  pot_capacity: optionalNumber({ min: 0, max: 10000, integer: true }),
};

export async function updateSpace(id: number, data: unknown) {
  const session = await requireUser();
  if ('error' in session) return { success: false, error: session.error };
  const { supabase } = session;

  const spaceId = parseId(id);
  if (!spaceId) return { success: false, error: "Ese espacio no es válido." };

  const { data: updates, invalid } = pickFields(data, SPACE_FIELDS);
  if (invalid.length > 0) {
    return { success: false, error: "Revisá los datos de la ficha: hay valores que no se entienden." };
  }
  if (Object.keys(updates).length === 0) return { success: true };

  const { error } = await supabase.from("spaces").update(updates).eq("id", spaceId);

  if (error) {
    return { success: false, error: friendlyDbError(error, "Error al actualizar el espacio", {}, "Error updating space:") };
  }

  revalidatePath("/spaces");
  return { success: true };
}

export async function createSpaceInline(name: string, type: 'Indoor' | 'Outdoor' | 'Mixto') {
  const session = await requireUser();
  if ('error' in session) return { success: false, error: session.error };
  const { supabase, user } = session;

  const cleanName = typeof name === 'string' ? name.trim().slice(0, 80) : '';
  if (!cleanName) return { success: false, error: "El espacio necesita un nombre." };
  if (!SPACE_TYPES.includes(type)) return { success: false, error: "Elegí un tipo de espacio." };

  const { data, error } = await supabase
    .from("spaces")
    .insert({ name: cleanName, type, user_id: user.id })
    .select('id')
    .single();

  if (error || !data) {
    return { success: false, error: friendlyDbError(error, "Error al crear el espacio", {}, "Error creating space inline:") };
  }

  revalidatePath("/spaces");
  return { success: true, spaceId: data.id };
}

/**
 * Borra un espacio. Sus ciclos no se borran: quedan sin espacio. Una tarea de
 * "Cambiar ambiente" que lo tenía de destino queda sin destino (antes el
 * borrado fallaba con un error de la base).
 */
export async function deleteSpace(id: number) {
  const session = await requireUser();
  if ('error' in session) return { success: false, error: session.error };
  const { supabase } = session;

  const spaceId = parseId(id);
  if (!spaceId) return { success: false, error: "Ese espacio no es válido." };

  const { error } = await supabase.from("spaces").delete().eq("id", spaceId);
  if (error) {
    return {
      success: false,
      error: friendlyDbError(error, "No se pudo eliminar el espacio.", {
        '23503': "Hay tareas que todavía apuntan a este espacio.",
      }, "Error eliminando el espacio:"),
    };
  }

  revalidatePath("/spaces");
  revalidatePath("/cycles");
  revalidatePath("/");
  return { success: true };
}
