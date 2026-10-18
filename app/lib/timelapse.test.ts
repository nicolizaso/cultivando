import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTimelapseFrames, plantsWithFrames } from './timelapse.ts';

const periods = [
  { stage: 'Vegetativo' as const, from: '2026-09-01', to: '2026-09-20' },
  { stage: 'Floración' as const, from: '2026-09-20', to: null },
];

test('buildTimelapseFrames - junta galería y bitácora en orden, con día y etapa', () => {
  const frames = buildTimelapseFrames({
    cycleStart: '2026-09-01',
    periods,
    plantNames: new Map([[7, 'Gorilla #1']]),
    gallery: [
      { id: 'a', public_url: 'https://x/a.jpg', taken_at: '2026-09-25T15:00:00Z', created_at: null, description: 'Semana 4' },
    ],
    logs: [
      { id: 1, plant_id: 7, created_at: '2026-09-05T15:00:00Z', media_url: ['https://x/b.jpg', 'https://x/c.jpg'], title: 'Foto' },
    ],
  });
  assert.deepEqual(frames.map((f) => f.url), ['https://x/b.jpg', 'https://x/c.jpg', 'https://x/a.jpg']);
  assert.equal(frames[0].day, 4);
  assert.equal(frames[0].stage, 'Vegetativo');
  assert.equal(frames[0].caption, 'Gorilla #1');
  assert.equal(frames[2].stage, 'Floración');
  assert.equal(frames[2].day, 24);
  assert.equal(frames[2].plantId, null);
});

test('buildTimelapseFrames - una foto repetida sale una sola vez y sin fecha no entra', () => {
  const frames = buildTimelapseFrames({
    cycleStart: '2026-09-01',
    periods: [],
    gallery: [
      { id: 'a', public_url: 'https://x/a.jpg', taken_at: '2026-09-02T15:00:00Z', created_at: null, description: null },
      { id: 'b', public_url: 'https://x/b.jpg', taken_at: null, created_at: null, description: null },
    ],
    logs: [{ id: 1, plant_id: null, created_at: '2026-09-03T15:00:00Z', media_url: ['https://x/a.jpg'], title: null }],
  });
  assert.equal(frames.length, 1);
  assert.equal(frames[0].stage, null);
});

test('buildTimelapseFrames - una foto anterior al inicio cuenta como día 0', () => {
  const [frame] = buildTimelapseFrames({
    cycleStart: '2026-09-10',
    periods: [],
    gallery: [{ id: 'a', public_url: 'https://x/a.jpg', taken_at: '2026-09-02T15:00:00Z', created_at: null, description: null }],
    logs: [],
  });
  assert.equal(frame.day, 0);
});

test('plantsWithFrames - plantas con fotos propias', () => {
  const frames = buildTimelapseFrames({
    cycleStart: '2026-09-01',
    periods: [],
    gallery: [],
    logs: [
      { id: 1, plant_id: 7, created_at: '2026-09-05T15:00:00Z', media_url: ['https://x/b.jpg'], title: null },
      { id: 2, plant_id: 8, created_at: '2026-09-06T15:00:00Z', media_url: ['https://x/c.jpg'], title: null },
      { id: 3, plant_id: 7, created_at: '2026-09-07T15:00:00Z', media_url: ['https://x/d.jpg'], title: null },
    ],
  });
  assert.deepEqual(plantsWithFrames(frames), [7, 8]);
});
