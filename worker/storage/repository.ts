import type {
  CapabilityDecision,
  CredentialMeta,
  DashboardSnapshot,
  Diagnostics,
  TokenKind,
} from '../../shared/dashboard';
import type { EncryptedToken } from '../settings/crypto';
export interface StoredCredential extends CredentialMeta {
  encrypted: EncryptedToken;
}
export interface StoredSettings {
  revision: number;
  account: { id: string; name: string } | null;
  credentials: Partial<Record<TokenKind, StoredCredential>>;
  capabilities: Record<string, CapabilityDecision>;
}
export class RevisionConflict extends Error {
  constructor() {
    super('配置或数据已更新，请重新读取后再操作');
  }
}
export class Repository {
  readonly diagnostics: Diagnostics = { rowsRead: 0, rowsWritten: 0, apiCalls: 0, elapsedMs: 0 };
  constructor(public db: D1Database) {}
  private count(meta: D1Meta) {
    this.diagnostics.rowsRead += meta.rows_read;
    this.diagnostics.rowsWritten += meta.rows_written;
  }
  async settings(): Promise<StoredSettings> {
    const r = await this.db
      .prepare('SELECT data FROM dashboard_settings WHERE id = 1')
      .all<{ data: string }>();
    this.count(r.meta);
    if (!r.results[0]) throw new Error('数据库尚未初始化，请运行本地迁移');
    return JSON.parse(r.results[0].data);
  }
  async snapshot(): Promise<DashboardSnapshot | null> {
    const r = await this.db
      .prepare('SELECT data FROM dashboard_state WHERE id = 1')
      .all<{ data: string }>();
    this.count(r.meta);
    return r.results[0] ? JSON.parse(r.results[0].data) : null;
  }
  async acquireRefresh(nonce: string, now = Date.now()): Promise<boolean> {
    const r = await this.db
      .prepare(
        'UPDATE dashboard_state SET lease_nonce = ?, lease_until = ? WHERE id = 1 AND lease_until <= ?',
      )
      .bind(nonce, now + 300000, now)
      .run();
    this.count(r.meta);
    return r.meta.changes === 1;
  }
  async releaseRefresh(nonce: string) {
    const r = await this.db
      .prepare(
        'UPDATE dashboard_state SET lease_nonce = NULL, lease_until = 0 WHERE id = 1 AND lease_nonce = ?',
      )
      .bind(nonce)
      .run();
    this.count(r.meta);
  }
  async saveSettings(next: StoredSettings, expected: number) {
    next.revision = expected + 1;
    const r = await this.db
      .prepare('UPDATE dashboard_settings SET revision = ?, data = ? WHERE id = 1 AND revision = ?')
      .bind(next.revision, JSON.stringify(next), expected)
      .run();
    this.count(r.meta);
    if (!r.meta.changes) throw new RevisionConflict();
  }
  async saveSnapshot(next: DashboardSnapshot, expected: number, nonce: string | null = null) {
    const r = await this.db
      .prepare(
        `INSERT INTO dashboard_state(id,revision,settings_revision,data)
      SELECT 1, ?, ?, ? WHERE EXISTS(SELECT 1 FROM dashboard_settings WHERE id = 1 AND revision = ?)
      ON CONFLICT(id) DO UPDATE SET revision=excluded.revision, settings_revision=excluded.settings_revision, data=excluded.data, lease_nonce=NULL, lease_until=0
      WHERE dashboard_state.revision = ? AND (dashboard_state.data = 'null' OR json_extract(dashboard_state.data,'$.attemptedAt') <= ?)
      AND (? IS NULL OR dashboard_state.lease_nonce = ?)`,
      )
      .bind(
        next.revision,
        next.settingsRevision,
        JSON.stringify(next),
        next.settingsRevision,
        expected,
        next.attemptedAt,
        nonce,
        nonce,
      )
      .run();
    this.count(r.meta);
    if (!r.meta.changes) throw new RevisionConflict();
  }
}
