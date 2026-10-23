export type TokenKind = 'account' | 'user';
export type RefreshReason = 'open' | 'manual';
export type MetricStatus = 'ok' | 'no_records' | 'not_enabled' | 'error' | 'partial';
export type Coverage = 'complete' | 'partial' | 'unverified';
export type PeriodKind = 'day' | 'calendar_month' | 'billing_cycle' | 'instant';
export interface Period {
  kind: PeriodKind;
  start: string | null;
  end: string | null;
  timeZone: 'UTC';
}
export interface PricingRule {
  included: string;
  rate: string;
  per: string;
  roundUp?: boolean;
  hardLimit?: boolean;
  sharedWith?: string;
  note?: string;
  effectiveUntil?: string;
}
export interface Product {
  id: string;
  name: string;
  description: string;
  group: 'Workers Paid' | 'AI 与媒体' | '网络与订阅';
  icon: string;
  color: string;
  source: string;
}
export interface MetricDefinition {
  id: string;
  productId: string;
  label: string;
  unit: string;
  period: PeriodKind;
  source: string;
  pricing?: PricingRule;
  included?: string;
  hardLimit?: boolean;
  note?: string;
  preferredToken?: TokenKind;
}
export interface CapabilityDecision {
  visibility: 'visible' | 'excluded';
  reason: string;
  checkedAt: string;
  evidence: string;
}
export interface Observation {
  usage: string | null;
  status: MetricStatus;
  period: Period;
  coverage: Coverage;
  at: string;
  source: string;
  message?: string;
  included?: string;
  reportedCost?: string;
  reportedUsage?: string;
  chargeCoverage?: Coverage;
  chargeThrough?: string;
  estimated?: boolean;
  rangeStart?: string;
}
export interface MetricView {
  id: string;
  definition: MetricDefinition;
  current: Observation;
  lastSuccess: Observation | null;
  capability: CapabilityDecision;
}
export interface Subscription {
  id: string;
  name: string;
  planId: string;
  price: string;
  currency: string;
  frequency: string;
  start: string | null;
  end: string | null;
  state: string;
  effectiveAt?: string | null;
  components: Array<{ name: string; label: string; kind: string; value: string }>;
}
export interface CostSummary {
  fixed: string | null;
  fixedOther?: Array<{ frequency: string; amount: string }>;
  reported: string;
  estimated: string;
  dailyEstimated?: string;
  unpriced: number;
  complete: boolean;
  currency: 'USD';
  note: string;
}
export interface Diagnostics {
  rowsRead: number;
  rowsWritten: number;
  apiCalls: number;
  elapsedMs: number;
}
export interface DashboardSnapshot {
  revision: number;
  settingsRevision: number;
  attemptedAt: string;
  succeededAt: string | null;
  account: { id: string; name: string };
  billingPeriod: Period;
  subscriptions: Subscription[];
  metrics: Record<string, MetricView>;
  costs: CostSummary;
  diagnostics?: Diagnostics;
  warnings: string[];
}
export interface CredentialMeta {
  suffix: string;
  verifiedAt: string;
}
export interface PublicSettings {
  revision: number;
  account: { id: string; name: string } | null;
  credentials: Partial<Record<TokenKind, CredentialMeta>>;
  encryptionReady: boolean;
}
export interface BootstrapResponse {
  settings: PublicSettings;
  snapshot: DashboardSnapshot | null;
  capabilities: Record<string, CapabilityDecision>;
}
export interface QuotaDisplay {
  percent: string | null;
  remaining: string | null;
  excess: string | null;
  level: 'normal' | 'warning' | 'danger' | 'exceeded' | 'unknown';
}
