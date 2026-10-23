import { useState, type FormEvent } from 'react';
import {
  KeyRound,
  ShieldCheck,
  Check,
  Loader2,
  Trash2,
  ScanSearch,
  LockKeyhole,
  ArrowUpRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useDashboard } from '../app/DashboardProvider';
import { dateTime } from '../lib/format';
import type { TokenKind } from '../../shared/dashboard';
function TokenForm({ kind }: { kind: TokenKind }) {
  const { settings, saveToken, clearToken, validateToken, demo } = useDashboard(),
    [value, setValue] = useState(''),
    [busy, setBusy] = useState(''),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [show, setShow] = useState(false),
    [confirmClear, setConfirmClear] = useState(false);
  const saved = settings?.credentials[kind];
  const run = async (action: string) => {
    setBusy(action);
    setError('');
    setMessage('');
    try {
      if (action === 'clear') {
        await clearToken(kind);
        setConfirmClear(false);
        setMessage('已清除 Token');
      } else if (action === 'validate') {
        await validateToken(kind, value.trim());
        setMessage('验证成功，尚未保存');
      } else {
        await saveToken(kind, value.trim());
        setValue('');
        setMessage('已加密保存，点击立即刷新获取用量');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy('');
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run('save');
  };
  return (
    <form className="panel token-form" onSubmit={submit}>
      <div className="token-form-title">
        <span className="token-icon">
          <KeyRound size={21} />
        </span>
        <div>
          <h2>{kind === 'account' ? '账户级 Token' : '用户级 Token'}</h2>
          <p>{kind === 'account' ? '访问账户内资源与用量' : '兼容 Builds、账单及账户统计'}</p>
        </div>
        <span className={`saved-status ${saved ? 'saved' : ''}`}>
          {saved ? (
            <>
              <Check size={12} />
              已保存
            </>
          ) : (
            '未配置'
          )}
        </span>
      </div>
      <div className="saved-token">
        {saved ? (
          <>
            <span className="masked-token">•••• •••• •••• {saved.suffix}</span>
            <span>验证于 {dateTime(saved.verifiedAt)}</span>
          </>
        ) : (
          <span>尚未保存此类型的 Token</span>
        )}
      </div>
      <Label htmlFor={'token-' + kind}>{saved ? '替换 Token' : 'API Token'}</Label>
      <div className="token-input">
        <Input
          id={'token-' + kind}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={saved ? '输入新 Token 以替换' : '输入只读 API Token'}
          autoComplete="off"
          spellCheck={false}
          disabled={!!busy || demo}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          aria-label={show ? '隐藏输入的 Token' : '显示输入的 Token'}
        >
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      <p className="input-help">只读权限 · 仅验证账户与读取数据</p>
      <div className="token-actions">
        <Button type="submit" disabled={!value.trim() || !!busy || demo}>
          {busy === 'save' ? <Loader2 className="spin" /> : <LockKeyhole size={14} />}验证并保存
        </Button>
        <Button
          variant="outline"
          type="button"
          disabled={!value.trim() || !!busy || demo}
          onClick={() => void run('validate')}
        >
          {busy === 'validate' ? <Loader2 className="spin" /> : null}仅验证
        </Button>
        <Button
          variant="ghost"
          type="button"
          disabled={!saved || !!busy || demo}
          onClick={() => setConfirmClear(true)}
          aria-label={'清除' + (kind === 'account' ? '账户级' : '用户级') + ' Token'}
        >
          <Trash2 size={15} />
        </Button>
      </div>
      {confirmClear ? (
        <div className="clear-confirm">
          <p>清除此 Token？另一类型的配置会保留。</p>
          <Button type="button" size="sm" variant="destructive" onClick={() => void run('clear')}>
            确认清除
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>
            取消
          </Button>
        </div>
      ) : null}
      {message ? (
        <p className="form-success" role="status">
          <Check size={14} />
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
export function Settings() {
  const { settings, recheck, demo } = useDashboard(),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState('');
  const audit = async () => {
    setBusy(true);
    try {
      await recheck();
      setResult('来源能力核查完成，指标可见清单已更新。');
    } catch (e) {
      setResult(e instanceof Error ? e.message : '核查失败');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            Token 与设置<span className="heading-dot">.</span>
          </h1>
          <p>连接你的账户，让每项资源用量都有据可查。</p>
        </div>
      </div>
      <div className="settings-info">
        <ShieldCheck size={21} />
        <div>
          <strong>凭据在服务端加密保存</strong>
          <p>使用 AES-GCM 加密写入 D1，页面只显示末尾 4 位。主密钥由 Worker Secret 提供。</p>
        </div>
        <span className={settings?.encryptionReady ? 'encryption-ok' : 'encryption-missing'}>
          {settings?.encryptionReady ? '加密已就绪' : '需配置主密钥'}
        </span>
      </div>
      <div className="token-grid">
        <TokenForm kind="account" />
        <TokenForm kind="user" />
      </div>
      <section className="panel capability-panel">
        <div>
          <span className="audit-icon">
            <ScanSearch size={22} />
          </span>
          <h2>重新核查指标来源</h2>
          <p>主动检查来源能力。普通刷新遇到临时失败时，指标清单仍会保留。</p>
        </div>
        <Button
          variant="outline"
          onClick={() => void audit()}
          disabled={busy || !settings?.account || demo}
        >
          {busy ? <Loader2 className="spin" /> : <ScanSearch size={16} />}重新核查
        </Button>
        {result ? <p role="status">{result}</p> : null}
      </section>
      <section className="settings-notes">
        <h2>连接说明</h2>
        <div>
          <span>01</span>
          <p>两个 Token 必须访问同一个账户。可以先保存一个，另一类型独立保存或替换。</p>
        </div>
        <div>
          <span>02</span>
          <p>使用只读权限，无需提升监控 Token 的写权限。缺少权限和网络故障会明确显示。</p>
        </div>
        <div>
          <span>03</span>
          <p>仅在打开网页与手动操作时更新。内部切换产品页面会复用当前结果。</p>
        </div>
        <a
          href="https://dash.cloudflare.com/profile/api-tokens"
          target="_blank"
          rel="noreferrer"
          className="text-link"
        >
          管理 Cloudflare API Tokens
          <ArrowUpRight size={15} />
        </a>
      </section>
    </>
  );
}
