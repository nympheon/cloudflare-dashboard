import { useEffect, useRef, useState } from 'react';
import type { QuotaDisplay } from '../../../shared/dashboard';
import { number } from '../../lib/format';
export function QuotaRing({
  quota,
  color = '#f38020',
  size = 120,
  label,
}: {
  quota: QuotaDisplay;
  color?: string;
  size?: number;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null),
    [visible, setVisible] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  const value = quota.percent === null ? 0 : Math.min(100, Math.max(0, Number(quota.percent))),
    r = 46,
    c = 2 * Math.PI * r;
  const stroke =
    quota.level === 'exceeded' ? '#e45050' : quota.level === 'danger' ? '#ed8d2f' : color;
  return (
    <div
      ref={ref}
      className={`quota-ring ${visible ? 'in-view' : ''}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}：${quota.percent === null ? '比例未知' : number(quota.percent) + '%'}`}
    >
      <svg viewBox="0 0 112 112" aria-hidden="true">
        <circle cx="56" cy="56" r={r} fill="none" stroke="#edf0f3" strokeWidth="8" />
        <circle
          className="ring-value"
          cx="56"
          cy="56"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          transform="rotate(-90 56 56)"
        />
      </svg>
      <div className="ring-number">
        <strong>
          {quota.percent === null ? '—' : number(quota.percent, quota.percent === '0' ? 0 : 2)}
          {quota.percent !== null ? <span>%</span> : null}
        </strong>
        <small>{quota.percent === null ? '比例未知' : '已使用'}</small>
      </div>
    </div>
  );
}
