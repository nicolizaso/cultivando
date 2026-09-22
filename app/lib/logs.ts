/**
 * Tipos de la bitácora.
 *
 * El `type` de un registro se escribía con la mayúscula de su etiqueta ("Foto",
 * "Nota", "Cambio de Etapa") mientras que quien lo leía comparaba contra el id
 * en minúscula de la taxonomía ("foto"). Las dos formas convivían, nunca
 * coincidían, y el resultado era que las fotos cargadas desde la bitácora de
 * una planta no aparecían ni en su ficha ni en la agenda.
 *
 * Acá viven las dos mitades: con qué valor se escribe y cómo se reconoce lo
 * que ya está escrito. Los registros viejos se quedan con su mayúscula, así
 * que leer siempre normaliza en vez de comparar de forma exacta.
 */

/** Los valores con los que se escribe, en minúscula como el resto de la taxonomía. */
export const LOG_TYPE = {
  photo: 'foto',
  note: 'nota',
} as const;

/**
 * Deja un `type` en la forma canónica: minúsculas y sin espacios sobrantes.
 * Devuelve cadena vacía si no hay tipo.
 */
export function normalizeLogType(type?: string | null): string {
  return typeof type === 'string' ? type.trim().toLowerCase() : '';
}

/**
 * ¿El registro es una foto?
 *
 * Es el único filtro que usan la ficha de la planta y la agenda, y estaba
 * escrito a mano en las dos con el literal en minúscula. Ahora es uno solo y
 * entiende también las mayúsculas heredadas.
 */
export function isPhotoLog(log?: { type?: string | null } | null): boolean {
  return normalizeLogType(log?.type) === LOG_TYPE.photo;
}
