import { test } from 'node:test';
import assert from 'node:assert';
import {
  buildCloneName,
  buildClonePlants,
  describeCloneBatch,
  sanitizeCloneEntries,
  totalClones,
  validateCloneEntries,
  MAX_CLONES_PER_MOTHER,
} from './clones.ts';
import type { CloneMother } from './clones.ts';

function mother(overrides: Partial<CloneMother> = {}): CloneMother {
  return {
    id: 1,
    name: 'Lemon Haze',
    strain: 'Lemon Haze',
    breeder: 'Green House',
    existingClones: 0,
    ...overrides,
  };
}

test('sanitizeCloneEntries - descarta madres fuera de la tarea', () => {
  const entries = sanitizeCloneEntries(
    [{ motherId: 1, count: 2 }, { motherId: 99, count: 5 }],
    [1, 2]
  );
  assert.deepStrictEqual(entries, [{ motherId: 1, count: 2 }]);
});

test('sanitizeCloneEntries - descarta ceros, negativos y basura', () => {
  const entries = sanitizeCloneEntries(
    [
      { motherId: 1, count: 0 },
      { motherId: 2, count: -3 },
      { motherId: 2, count: Number.NaN },
      { motherId: 'x', count: 2 },
      null,
    ],
    [1, 2]
  );
  assert.deepStrictEqual(entries, []);
});

test('sanitizeCloneEntries - suma las filas repetidas de una misma madre', () => {
  const entries = sanitizeCloneEntries(
    [{ motherId: 2, count: 3 }, { motherId: 2, count: 1 }],
    [1, 2]
  );
  assert.deepStrictEqual(entries, [{ motherId: 2, count: 4 }]);
});

test('sanitizeCloneEntries - trunca decimales', () => {
  const entries = sanitizeCloneEntries([{ motherId: 1, count: 2.7 }], [1]);
  assert.deepStrictEqual(entries, [{ motherId: 1, count: 2 }]);
});

test('sanitizeCloneEntries - tolera un payload que no es lista', () => {
  assert.deepStrictEqual(sanitizeCloneEntries(undefined, [1]), []);
});

test('validateCloneEntries - acepta un reparto normal', () => {
  assert.strictEqual(validateCloneEntries([{ motherId: 1, count: 12 }]), null);
});

test('validateCloneEntries - rechaza demasiados esquejes de una madre', () => {
  const error = validateCloneEntries([{ motherId: 1, count: MAX_CLONES_PER_MOTHER + 1 }]);
  assert.ok(error && error.includes('misma planta'));
});

test('buildCloneName - numera desde el nombre de la madre', () => {
  assert.strictEqual(buildCloneName('Lemon Haze', 3), 'Lemon Haze · Esqueje 3');
});

test('buildCloneName - sobrevive a una madre sin nombre', () => {
  assert.strictEqual(buildCloneName('   ', 1), 'Planta · Esqueje 1');
});

test('buildClonePlants - crea una planta por esqueje y hereda la madre', () => {
  const seeds = buildClonePlants(
    [{ motherId: 1, count: 2 }],
    [mother()],
    { cycleId: 7, date: '2026-09-15' }
  );

  assert.strictEqual(seeds.length, 2);
  assert.deepStrictEqual(
    seeds.map((s) => s.name),
    ['Lemon Haze · Esqueje 1', 'Lemon Haze · Esqueje 2']
  );
  assert.strictEqual(seeds[0].mother_id, 1);
  assert.strictEqual(seeds[0].cycle_id, 7);
  assert.strictEqual(seeds[0].source_type, 'Esqueje');
  assert.strictEqual(seeds[0].strain, 'Lemon Haze');
  assert.strictEqual(seeds[0].breeder, 'Green House');
});

test('buildClonePlants - el día 0 es la fecha del corte, no la de la madre', () => {
  const [seed] = buildClonePlants(
    [{ motherId: 1, count: 1 }],
    [mother()],
    { cycleId: 7, date: '2026-09-15' }
  );

  assert.strictEqual(seed.stage, 'Enraizamiento');
  assert.strictEqual(seed.planted_at, '2026-09-15T12:00:00');
  assert.strictEqual(seed.date_enraizamiento, seed.planted_at);
  assert.strictEqual(seed.stage_updated_at, seed.planted_at);
});

test('buildClonePlants - sigue la numeración de los esquejes que ya existen', () => {
  const seeds = buildClonePlants(
    [{ motherId: 1, count: 2 }],
    [mother({ existingClones: 3 })],
    { cycleId: 7, date: '2026-09-15' }
  );

  assert.deepStrictEqual(
    seeds.map((s) => s.name),
    ['Lemon Haze · Esqueje 4', 'Lemon Haze · Esqueje 5']
  );
});

test('buildClonePlants - reparte entre varias madres en la misma tanda', () => {
  const seeds = buildClonePlants(
    [{ motherId: 1, count: 1 }, { motherId: 2, count: 2 }],
    [mother(), mother({ id: 2, name: 'Critical', strain: 'Critical', breeder: null })],
    { cycleId: 7, date: '2026-09-15' }
  );

  assert.strictEqual(seeds.length, 3);
  assert.deepStrictEqual(
    seeds.map((s) => s.name),
    ['Lemon Haze · Esqueje 1', 'Critical · Esqueje 1', 'Critical · Esqueje 2']
  );
  assert.strictEqual(seeds[1].breeder, null);
});

test('buildClonePlants - ignora una madre que no vino en la lista', () => {
  const seeds = buildClonePlants(
    [{ motherId: 42, count: 2 }],
    [mother()],
    { cycleId: 7, date: '2026-09-15' }
  );

  assert.deepStrictEqual(seeds, []);
});

test('totalClones y describeCloneBatch - resumen en palabras', () => {
  const entries = [{ motherId: 1, count: 4 }, { motherId: 2, count: 1 }];
  assert.strictEqual(totalClones(entries), 5);
  assert.strictEqual(describeCloneBatch(entries), '5 esquejes de 2 madres');
  assert.strictEqual(describeCloneBatch([{ motherId: 1, count: 1 }]), '1 esqueje de 1 madre');
  assert.strictEqual(describeCloneBatch([]), 'Sin esquejes');
});
