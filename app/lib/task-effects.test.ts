import { test } from 'node:test';
import assert from 'node:assert';
import { getTaskCompletionEffect, HARVEST_STAGE, shouldApplyStage } from './task-effects.ts';
import type { StageEffect } from './task-effects.ts';

test('cosechar pasa las plantas a secado, sin retroceder', () => {
  assert.deepStrictEqual(getTaskCompletionEffect({ type: 'cosechar' }), {
    kind: 'stage',
    stage: 'Secado',
    onlyForward: true,
  });
  assert.strictEqual(HARVEST_STAGE, 'Secado');
});

test('cambio_etapa usa la etapa elegida en la tarea', () => {
  assert.deepStrictEqual(getTaskCompletionEffect({ type: 'cambio_etapa', target_stage: 'Floración' }), {
    kind: 'stage',
    stage: 'Floración',
    onlyForward: false,
  });
});

test('cambio_etapa con una etapa inexistente no hace nada', () => {
  assert.strictEqual(getTaskCompletionEffect({ type: 'cambio_etapa', target_stage: 'stage; drop' }), null);
  assert.strictEqual(getTaskCompletionEffect({ type: 'cambio_etapa', target_stage: null }), null);
});

test('riego y fertilizante en riego actualizan el último riego', () => {
  assert.deepStrictEqual(getTaskCompletionEffect({ type: 'riego' }), { kind: 'water' });
  assert.deepStrictEqual(getTaskCompletionEffect({ type: 'fertilizante', application_type: 'Riego' }), { kind: 'water' });
  assert.strictEqual(getTaskCompletionEffect({ type: 'fertilizante', application_type: 'Foliar' }), null);
});

test('declarar muerta archiva la planta', () => {
  assert.deepStrictEqual(getTaskCompletionEffect({ type: 'muerta' }), { kind: 'archive' });
});

test('los tipos sin efecto devuelven null', () => {
  for (const type of ['poda', 'trasplante', 'lavado', 'otro', 'esquejado', 'ambiente', undefined]) {
    assert.strictEqual(getTaskCompletionEffect({ type }), null, `tipo ${type}`);
  }
});

test('shouldApplyStage: la cosecha sólo avanza', () => {
  const harvest: StageEffect = { kind: 'stage', stage: 'Secado', onlyForward: true };
  assert.strictEqual(shouldApplyStage('Floración', harvest), true);
  assert.strictEqual(shouldApplyStage('Vegetativo', harvest), true);
  assert.strictEqual(shouldApplyStage('Esqueje', harvest), true);
  assert.strictEqual(shouldApplyStage(null, harvest), true);
  assert.strictEqual(shouldApplyStage('Secado', harvest), false);
  assert.strictEqual(shouldApplyStage('Curado', harvest), false);
});

test('shouldApplyStage: un cambio de etapa explícito puede retroceder', () => {
  const back: StageEffect = { kind: 'stage', stage: 'Vegetativo', onlyForward: false };
  assert.strictEqual(shouldApplyStage('Floración', back), true);
  assert.strictEqual(shouldApplyStage('Vegetativo', back), false);
});
