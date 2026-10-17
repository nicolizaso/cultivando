import { test } from 'node:test';
import assert from 'node:assert';
import { vpd, vpdLevel } from './climate.ts';

test('vpd - valores conocidos', () => {
  // 25 °C y 60 % → ~1,27 kPa.
  assert.ok(Math.abs((vpd(25, 60) ?? 0) - 1.267) < 0.01);
  assert.strictEqual(vpd(25, 100), 0);
});

test('vpd - sin datos o con datos imposibles da null', () => {
  assert.strictEqual(vpd(null, 60), null);
  assert.strictEqual(vpd(25, undefined), null);
  assert.strictEqual(vpd(25, 140), null);
});

test('vpdLevel - bajo, en rango y alto', () => {
  assert.strictEqual(vpdLevel(0.3), 'low');
  assert.strictEqual(vpdLevel(1.0), 'ok');
  assert.strictEqual(vpdLevel(1.8), 'high');
  assert.strictEqual(vpdLevel(null), 'unknown');
});
