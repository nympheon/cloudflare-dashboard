import { useEffect, useRef, type CSSProperties } from 'react';
import type { QuotaDisplay } from '../../../shared/dashboard';
import { percentage } from '../../lib/format';

const cells = Array.from({ length: 100 }, (_, index) => index);

export function QuotaWaffle({
  quota,
  color,
  label,
}: {
  quota: QuotaDisplay;
  color?: string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const waffle = ref.current;
    if (!waffle || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(([entry]) => {
      waffle.dataset.inView = String(entry.isIntersecting);
      if (entry.isIntersecting) waffle.dataset.ready = '';
    });
    observer.observe(waffle);
    return () => observer.disconnect();
  }, []);

  const percent = Math.min(100, Math.max(0, Number(quota.percent ?? 0)));
  return (
    <div
      ref={ref}
      className="quota-waffle"
      data-level={quota.level}
      data-unknown={quota.percent === null ? '' : undefined}
      role="img"
      aria-label={`${label} · ${quota.percent === null ? '比例未知' : '已使用 ' + percentage(quota.percent)}`}
      style={{ '--metric-accent': color } as CSSProperties}
    >
      {cells.map((index) => {
        const fill = Math.max(0, Math.min(1, percent - index));
        return (
          <span
            key={index}
            aria-hidden="true"
            className="waffle-cell"
            data-filled={fill ? '' : undefined}
            style={
              {
                '--cell-fill': fill,
                '--cell-delay': `${Math.min(index * 2, 120)}ms`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
