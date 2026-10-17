/**
 * Subida de fotos al bucket `images`.
 *
 * Cada archivo va en la carpeta de su dueño (`<user_id>/…`): así la política
 * del bucket puede decir "cada uno sube y borra sólo lo suyo" mirando la ruta.
 */

export const IMAGES_BUCKET = 'images';

/**
 * Tope por archivo. Las fotos se comprimen en el navegador a ~1 MB antes de
 * viajar; el tope cubre la que no se pudo comprimir sin pasarse del límite
 * de cuerpo de las Server Actions (next.config.ts) ni del bucket (5 MB).
 */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/avif': 'avif',
};

/** `null` si se puede subir; si no, el motivo en palabras. */
export function validateImage(file: { type?: string; size?: number } | null | undefined): string | null {
  if (!file || typeof file.size !== 'number') return 'No llegó ninguna foto.';
  if (file.size === 0) return 'La foto está vacía.';
  if (!file.type || !IMAGE_EXTENSIONS[file.type]) return 'Ese archivo no es una foto (JPG, PNG, WEBP, HEIC o GIF).';
  if (file.size > MAX_IMAGE_BYTES) return 'La foto pesa demasiado (máximo 4 MB).';
  return null;
}

/**
 * Ruta del archivo en el bucket. El nombre lo arma el servidor con el tipo
 * real del archivo: el nombre que trae del teléfono no se usa para nada.
 */
export function buildImagePath(
  userId: string,
  folder: 'plants' | 'cycles',
  ownerId: number,
  type: string,
  now: number = Date.now(),
  random: number = Math.random()
): string {
  const extension = IMAGE_EXTENSIONS[type] ?? 'jpg';
  const suffix = Math.floor(random * 36 ** 6).toString(36).padStart(6, '0');
  return `${userId}/${folder}/${ownerId}/${now}-${suffix}.${extension}`;
}

/**
 * Ruta dentro del bucket a partir de la URL pública que guarda la base.
 * Devuelve null si la URL no es de este bucket.
 */
export function storagePathFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${IMAGES_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const path = url.slice(index + marker.length).split('?')[0];
  try {
    return decodeURIComponent(path) || null;
  } catch {
    return null;
  }
}
