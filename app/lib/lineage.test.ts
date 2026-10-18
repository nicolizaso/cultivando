import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ancestors, descendants, lineageStats, sortMotherOptions } from './lineage.ts';

const plants = [
  { id: 1, name: 'Abuela', mother_id: null, is_mother: true },
  { id: 2, name: 'Madre', mother_id: 1, is_mother: true, planted_at: '2026-05-01' },
  { id: 3, name: 'Tía', mother_id: 1, planted_at: '2026-04-01', is_archived: true },
  { id: 4, name: 'Esqueje #2', mother_id: 2, planted_at: '2026-08-01' },
  { id: 5, name: 'Esqueje #10', mother_id: 2, planted_at: '2026-08-01' },
  { id: 6, name: 'Nieta', mother_id: 4 },
  { id: 7, name: 'Suelta', mother_id: null },
];

test('ancestors - de la madre a la abuela', () => {
  assert.deepEqual(ancestors(6, plants).map((p) => p.id), [4, 2, 1]);
  assert.deepEqual(ancestors(1, plants), []);
});

test('descendants - árbol ordenado por fecha y nombre', () => {
  const tree = descendants(1, plants);
  assert.deepEqual(tree.map((n) => n.plant.name), ['Tía', 'Madre']);
  const madre = tree[1];
  assert.deepEqual(madre.children.map((n) => n.plant.name), ['Esqueje #2', 'Esqueje #10']);
  assert.equal(madre.children[0].children[0].plant.name, 'Nieta');
  assert.equal(madre.children[0].children[0].depth, 3);
});

test('lineageStats - esquejes, activos, descendencia y generación', () => {
  assert.deepEqual(lineageStats(1, plants), { clones: 2, activeClones: 1, descendants: 5, generationsBelow: 3, generation: 0 });
  assert.deepEqual(lineageStats(4, plants), { clones: 1, activeClones: 1, descendants: 1, generationsBelow: 1, generation: 2 });
  assert.deepEqual(lineageStats(7, plants), { clones: 0, activeClones: 0, descendants: 0, generationsBelow: 0, generation: 0 });
});

test('un ciclo en los datos no cuelga nada', () => {
  const broken = [
    { id: 1, name: 'A', mother_id: 2 },
    { id: 2, name: 'B', mother_id: 1 },
  ];
  assert.deepEqual(ancestors(1, broken).map((p) => p.id), [2]);
  assert.equal(lineageStats(1, broken).descendants, 1);
});

test('sortMotherOptions - madres primero', () => {
  assert.deepEqual(sortMotherOptions(plants).map((p) => p.id).slice(0, 2), [1, 2]);
});
