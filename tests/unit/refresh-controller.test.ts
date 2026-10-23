import { it, expect, vi } from 'vitest';
import { createController, createResponseGate } from '../../src/app/controller';
import type { BootstrapResponse, DashboardSnapshot } from '../../shared/dashboard';
it('deduplicates bootstrap and in-flight refresh; no timer, focus or navigation listeners', async () => {
  const bootstrap = vi.fn(async () => ({}) as BootstrapResponse),
    refresh = vi.fn(async () => ({}) as DashboardSnapshot);
  const c = createController(bootstrap, refresh);
  await Promise.all([c.bootstrap(), c.bootstrap()]);
  expect(bootstrap).toHaveBeenCalledTimes(1);
  await Promise.all([c.refresh('open'), c.refresh('manual'), c.refresh('manual')]);
  expect(refresh).toHaveBeenCalledTimes(1);
  await c.refresh('manual');
  expect(refresh).toHaveBeenCalledTimes(2);
});
it('rejects refresh responses started before a Token configuration change', () => {
  const gate = createResponseGate(),
    generation = gate.current();
  gate.invalidate();
  expect(gate.accept(generation)).toBe(false);
  expect(gate.accept(gate.current())).toBe(true);
});
