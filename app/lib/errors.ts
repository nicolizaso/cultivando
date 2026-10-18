/**
 * Errores de la base traducidos para la pantalla.
 *
 * El mensaje crudo de Postgres ("violates foreign key constraint…") no le
 * sirve a quien usa la app y además cuenta detalles del esquema. Acá se
 * registra completo en el log del servidor y hacia afuera sale una frase.
 */

interface DbErrorLike {
  code?: string;
  message?: string;
}

/** Mensajes por código de Postgres / PostgREST que valen para cualquier tabla. */
const GENERIC_MESSAGES: Record<string, string> = {
  '23505': 'Ya existe un registro con esos datos.',
  '23514': 'Algún dato tiene un valor que no está permitido.',
  '22P02': 'Algún dato no tiene el formato esperado.',
  '22007': 'Alguna fecha no tiene el formato esperado.',
  '42501': 'No tenés permiso para hacer eso.',
  PGRST116: 'No se encontró lo que buscabas.',
};

/**
 * Devuelve la frase para el usuario y deja el error completo en el log.
 *
 * @param fallback  Lo que se dice si el código no tiene una frase propia.
 * @param overrides Frases específicas del caso (por ejemplo, qué significa un
 *                  23503 al borrar una planta madre).
 */
export function friendlyDbError(
  error: unknown,
  fallback: string,
  overrides: Record<string, string> = {},
  context?: string
): string {
  if (context) console.error(context, error);

  const code = (error as DbErrorLike | null)?.code;
  if (!code) return fallback;
  return overrides[code] ?? GENERIC_MESSAGES[code] ?? fallback;
}
