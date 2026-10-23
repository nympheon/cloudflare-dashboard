export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export function obj(v: unknown): Record<string, Json> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, Json>)
    : {};
}
export function arr(v: unknown): Json[] {
  return Array.isArray(v) ? v : [];
}
export function text(v: unknown): string {
  return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
}
export function numeric(v: unknown): string | null {
  const s = text(v);
  return /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s) ? s : null;
}
