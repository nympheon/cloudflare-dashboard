import type { BootstrapResponse, DashboardSnapshot, RefreshReason } from '../../shared/dashboard';
export function createResponseGate() {
  let generation = 0;
  return {
    current: () => generation,
    invalidate: () => {
      generation++;
    },
    accept: (candidate: number) => candidate === generation,
  };
}
export function createController(
  bootstrap: () => Promise<BootstrapResponse>,
  refresh: (reason: RefreshReason) => Promise<DashboardSnapshot>,
) {
  let initial: Promise<BootstrapResponse> | null = null,
    inflight: Promise<DashboardSnapshot> | null = null;
  const refreshOnce = (reason: RefreshReason) => {
    if (inflight) return inflight;
    inflight = refresh(reason).finally(() => {
      inflight = null;
    });
    return inflight;
  };
  return { bootstrap: () => initial ?? (initial = bootstrap()), refresh: refreshOnce };
}
