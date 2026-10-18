#!/usr/bin/env node
// Borra del bucket `images` los archivos que ya no usa ninguna fila de la base
// (fotos de ciclos, fotos de la bitácora y portadas de plantas).
//
// Storage no deja borrar archivos con SQL, así que esto usa su API con la
// clave de servicio. Por defecto sólo lista; con --borrar los elimina.
//
//   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/limpiar-fotos-huerfanas.mjs
//   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/limpiar-fotos-huerfanas.mjs --borrar

import { createClient } from '@supabase/supabase-js';

const BUCKET = 'images';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apply = process.argv.includes('--borrar');

if (!url || !key) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

/** Ruta dentro del bucket a partir de la URL pública guardada en la base. */
function pathFromUrl(publicUrl) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const index = publicUrl?.indexOf(marker) ?? -1;
  if (index === -1) return null;
  return decodeURIComponent(publicUrl.slice(index + marker.length).split('?')[0]);
}

/** Todos los archivos del bucket, entrando en las carpetas. */
async function listAll(prefix = '') {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const entry of data) {
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) files.push(...(await listAll(fullPath)));
      else files.push({ path: fullPath, size: entry.metadata?.size ?? 0 });
    }
    if (data.length < 1000) break;
  }
  return files;
}

async function referencedPaths() {
  const [images, logs, plants] = await Promise.all([
    supabase.from('cycle_images').select('storage_path, public_url'),
    supabase.from('logs').select('media_url').not('media_url', 'is', null),
    supabase.from('plants').select('image_url').not('image_url', 'is', null),
  ]);
  for (const result of [images, logs, plants]) if (result.error) throw result.error;

  const used = new Set();
  for (const row of images.data) {
    if (row.storage_path) used.add(row.storage_path);
    const fromUrl = pathFromUrl(row.public_url);
    if (fromUrl) used.add(fromUrl);
  }
  for (const row of logs.data) for (const media of row.media_url ?? []) {
    const path = pathFromUrl(media);
    if (path) used.add(path);
  }
  for (const row of plants.data) {
    const path = pathFromUrl(row.image_url);
    if (path) used.add(path);
  }
  return used;
}

const [files, used] = await Promise.all([listAll(), referencedPaths()]);
const orphans = files.filter((file) => !used.has(file.path));
const totalKb = Math.round(orphans.reduce((sum, file) => sum + file.size, 0) / 1024);

console.log(`Archivos en el bucket: ${files.length}. Sin uso: ${orphans.length} (${totalKb} kB).`);
for (const file of orphans) console.log(`  ${file.path}`);

if (!apply) {
  console.log('\nNo se borró nada. Para borrarlos, volvé a correrlo con --borrar.');
  process.exit(0);
}

for (let i = 0; i < orphans.length; i += 100) {
  const batch = orphans.slice(i, i + 100).map((file) => file.path);
  const { error } = await supabase.storage.from(BUCKET).remove(batch);
  if (error) {
    console.error('Error borrando:', error.message);
    process.exit(1);
  }
}
console.log(`\nListo: ${orphans.length} archivos borrados.`);
