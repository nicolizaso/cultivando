import { test } from 'node:test';
import assert from 'node:assert';
import { MAX_IMAGE_BYTES, buildImagePath, storagePathFromPublicUrl, validateImage } from './uploads.ts';

test('validateImage - acepta fotos y rechaza lo demás', () => {
  assert.strictEqual(validateImage({ type: 'image/jpeg', size: 500_000 }), null);
  assert.strictEqual(validateImage({ type: 'image/heic', size: 500_000 }), null);
  assert.match(validateImage({ type: 'text/html', size: 100 }) ?? '', /no es una foto/);
  assert.match(validateImage({ type: 'image/svg+xml', size: 100 }) ?? '', /no es una foto/);
  assert.match(validateImage({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 }) ?? '', /pesa demasiado/);
  assert.match(validateImage({ type: 'image/png', size: 0 }) ?? '', /vacía/);
  assert.match(validateImage(null) ?? '', /No llegó/);
});

test('buildImagePath - va en la carpeta del dueño y usa el tipo real', () => {
  const path = buildImagePath('user-1', 'plants', 42, 'image/webp', 1700000000000, 0.5);
  assert.match(path, /^user-1\/plants\/42\/1700000000000-[0-9a-z]{6}\.webp$/);
});

test('storagePathFromPublicUrl - saca la ruta de la URL pública', () => {
  const url = 'https://abc.supabase.co/storage/v1/object/public/images/user-1/plants/4/foto%201.jpg';
  assert.strictEqual(storagePathFromPublicUrl(url), 'user-1/plants/4/foto 1.jpg');
  assert.strictEqual(storagePathFromPublicUrl('https://abc.supabase.co/storage/v1/object/public/images/cycle_3_1.jpg?t=1'), 'cycle_3_1.jpg');
  assert.strictEqual(storagePathFromPublicUrl('https://otro.com/foto.jpg'), null);
  assert.strictEqual(storagePathFromPublicUrl(null), null);
});
