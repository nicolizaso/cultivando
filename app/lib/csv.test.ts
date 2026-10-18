import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, fileSlug, toCsv } from './csv.ts';

test('csvCell - números con coma, textos escapados', () => {
  assert.equal(csvCell(6.2), '6,2');
  assert.equal(csvCell(1 / 3), '0,333');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(true), 'sí');
  assert.equal(csvCell('hola; chau'), '"hola; chau"');
  assert.equal(csvCell('dijo "sí"'), '"dijo ""sí"""');
  assert.equal(csvCell('dos\nrenglones'), '"dos\nrenglones"');
});

test('csvCell - un texto no se convierte en fórmula', () => {
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell('-5 grados'), "'-5 grados");
  assert.equal(csvCell(-5), '-5');
});

test('toCsv - BOM, separador y fin de línea', () => {
  assert.equal(toCsv([['a', 1.5], ['b', null]]), '﻿a;1,5\r\nb;\r\n');
});

test('fileSlug', () => {
  assert.equal(fileSlug('Ciclo #3 – Otoño'), 'ciclo-3-otono');
  assert.equal(fileSlug('***'), 'ciclo');
});
