import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { api } from '../lib/api';
import { createController, createResponseGate } from './controller';
import type {
  BootstrapResponse,
  DashboardSnapshot,
  PublicSettings,
  TokenKind,
} from '../../shared/dashboard';
const controller = createController(
  () => api<BootstrapResponse>('bootstrap'),
  (reason) => api<DashboardSnapshot>('refresh', 'POST', { reason }),
);
type Model = {
  snapshot: DashboardSnapshot | null;
  settings: PublicSettings | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  demo: boolean;
  refresh: () => Promise<void>;
  saveToken: (kind: TokenKind, value: string) => Promise<void>;
  clearToken: (kind: TokenKind) => Promise<void>;
  validateToken: (kind: TokenKind, value: string) => Promise<void>;
  recheck: () => Promise<void>;
};
const Context = createContext<Model | null>(null);
export function DashboardProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null),
    [settings, setSettings] = useState<PublicSettings | null>(null),
    [loading, setLoading] = useState(true),
    [refreshing, setRefreshing] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [demo] = useState(
    () => import.meta.env.DEV && new URLSearchParams(location.search).has('demo'),
  );
  const [scenario] = useState(() => new URLSearchParams(location.search).get('demo') ?? 'normal');
  const gate = useRef(createResponseGate());
  const settingsRef = useRef<PublicSettings | null>(null);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  const refresh = useCallback(async () => {
    const generation = gate.current.current();
    setRefreshing(true);
    setError(null);
    try {
      if (import.meta.env.DEV && demo) {
        const { demoSnapshot } = await import('../demo');
        setSnapshot(demoSnapshot(scenario));
      } else {
        const result = await controller.refresh('manual');
        if (
          gate.current.accept(generation) &&
          result.settingsRevision === settingsRef.current?.revision
        )
          setSnapshot(result);
      }
    } catch (e) {
      if (gate.current.accept(generation)) setError(e instanceof Error ? e.message : '刷新失败');
    } finally {
      setRefreshing(false);
    }
  }, [demo, scenario]);
  useEffect(() => {
    const visibility = () => document.body.classList.toggle('page-hidden', document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);
  useEffect(() => {
    let alive = true;
    const generation = gate.current.current();
    const init = async () => {
      try {
        if (import.meta.env.DEV && demo) {
          const { demoSnapshot, demoSettings } = await import('../demo');
          if (alive) {
            setSnapshot(demoSnapshot(new URLSearchParams(location.search).get('demo') ?? 'normal'));
            setSettings(demoSettings);
          }
          return;
        }
        const boot = await controller.bootstrap();
        if (!alive || !gate.current.accept(generation)) return;
        settingsRef.current = boot.settings;
        setSettings(boot.settings);
        setSnapshot(boot.snapshot);
        if (boot.settings.account && Object.keys(boot.settings.credentials).length) {
          setRefreshing(true);
          try {
            const latest = await controller.refresh('open');
            if (
              alive &&
              gate.current.accept(generation) &&
              latest.settingsRevision === settingsRef.current?.revision
            )
              setSnapshot(latest);
          } finally {
            if (alive) setRefreshing(false);
          }
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : '加载失败');
      } finally {
        if (alive) setLoading(false);
      }
    };
    void init();
    return () => {
      alive = false;
    };
  }, [demo]);
  const saveToken = async (kind: TokenKind, value: string) => {
    if (demo) throw new Error('演示模式不保存真实 Token');
    gate.current.invalidate();
    const generation = gate.current.current();
    const next = await api<PublicSettings>('tokens/' + kind, 'PUT', { token: value });
    if (gate.current.accept(generation)) {
      settingsRef.current = next;
      setSettings(next);
    }
  };
  const clearToken = async (kind: TokenKind) => {
    if (demo) throw new Error('演示模式不修改配置');
    gate.current.invalidate();
    const generation = gate.current.current();
    const next = await api<PublicSettings>('tokens/' + kind, 'DELETE');
    if (gate.current.accept(generation)) {
      settingsRef.current = next;
      setSettings(next);
      if (!next.account) setSnapshot(null);
    }
  };
  const validateToken = async (kind: TokenKind, value: string) => {
    if (demo) throw new Error('请在真实模式验证 Token');
    await api('tokens/' + kind + '/validate', 'POST', { token: value });
  };
  const recheck = async () => {
    if (demo) throw new Error('请在真实模式核查来源');
    gate.current.invalidate();
    const generation = gate.current.current();
    await api('capabilities/recheck', 'POST', {});
    const b = await api<BootstrapResponse>('bootstrap');
    if (gate.current.accept(generation)) {
      settingsRef.current = b.settings;
      setSettings(b.settings);
    }
  };
  return (
    <Context.Provider
      value={{
        snapshot,
        settings,
        loading,
        refreshing,
        error,
        demo,
        refresh,
        saveToken,
        clearToken,
        validateToken,
        recheck,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useDashboard() {
  const value = useContext(Context);
  if (!value) throw new Error('Missing DashboardProvider');
  return value;
}
