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

/**
 * Los valores con los que se escribe, en minúscula como el resto de la
 * taxonomía: los que no son foto o nota son los mismos ids que los tipos de
 * tarea, así el icono y el color salen de `getTaskType`.
 */
export const LOG_TYPE = {
  photo: 'foto',
  note: 'nota',
  water: 'riego',
  stage: 'cambio_etapa',
  ambiente: 'ambiente',
  harvest: 'cosecha',
  other: 'otro',
} as const;

/**
 * Deja un `type` en la forma canónica: minúsculas y sin espacios sobrantes.
 * Devuelve cadena vacía si no hay tipo.
 */
export function normalizeLogType(type?: string | null): string {
  return typeof type === 'string' ? type.trim().toLowerCase() : '';
}

/**
 * Los tipos heredados que no coinciden con ningún id: se escribían con la
 * etiqueta en vez del id. La migración los unifica en la base; esto cubre lo
 * que se haya escrito mientras tanto.
 */
const LEGACY_LOG_TYPES: Record<string, string> = {
  'cambio de etapa': LOG_TYPE.stage,
  'cambio de ambiente': LOG_TYPE.ambiente,
  image: LOG_TYPE.photo,
  imagen: LOG_TYPE.photo,
};

/** El tipo canónico de un registro, aunque venga con la forma vieja. */
export function canonicalLogType(type?: string | null): string {
  const normalized = normalizeLogType(type);
  return LEGACY_LOG_TYPES[normalized] ?? normalized;
}

/** Todos los tipos que acepta la bitácora (los de tarea, más foto, nota y cosecha). */
export const LOG_TYPES = [
  LOG_TYPE.photo, LOG_TYPE.note, LOG_TYPE.harvest,
  'riego', 'fertilizante', 'repelente', 'trasplante', 'esquejado', 'poda', 'entrenamiento',
  'ambiente', 'cambio_etapa', 'lavado', 'cosechar', 'muerta', 'otro',
] as const;

/**
 * ¿El registro es una foto?
 *
 * Es el único filtro que usan la ficha de la planta y la agenda, y estaba
 * escrito a mano en las dos con el literal en minúscula. Ahora es uno solo y
 * entiende también las mayúsculas heredadas.
 */
export function isPhotoLog(log?: { type?: string | null } | null): boolean {
  return canonicalLogType(log?.type) === LOG_TYPE.photo;
}
