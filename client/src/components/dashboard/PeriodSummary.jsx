import { useMemo } from 'react';
import { getPeriodRange, filterEventsInRange, pctDelta } from '../../utils/timeAgg.js';

const SUMMARY_PERIODS = [
  { id: 'week',  label: 'This Week'  },
  { id: 'month', label: 'This Month' },
  { id: 'ytd',   label: 'YTD'        },
  { id: 'year',  label: 'This Year'  },
];

function Delta({ value }) {
  if (value == null || !isFinite(value)) return <span className="summary-delta neutral">—</span>;
  if (Math.abs(value) < 0.5) return <span className="summary-delta neutral">±0%</span>;
  const up = value > 0;
  return (
    <span className={`summary-delta ${up ? 'up' : 'down'}`}>
      {up ? '↑' : '↓'} {Math.abs(value).toFixed(0)}%
    </span>
  );
}

export default function PeriodSummary({ events }) {
  const cards = useMemo(() => {
    const now = Date.now();
    return SUMMARY_PERIODS.map((p) => {
      const r = getPeriodRange(p.id, now);
      const inPeriod = filterEventsInRange(events, r.start, r.end);
      const inPrev =
        r.prevStart != null
          ? filterEventsInRange(events, r.prevStart, r.prevEnd)
          : null;
      return {
        ...p,
        count: inPeriod.length,
        prevCount: inPrev ? inPrev.length : null,
      };
    });
  }, [events]);

  return (
    <div className="period-summary">
      {cards.map((c) => (
        <div key={c.id} className="summary-card glass">
          <div className="summary-label">{c.label}</div>
          <div className="summary-value">
            {c.count}
            <span className="summary-unit">events</span>
          </div>
          {c.prevCount != null && (
            <Delta value={pctDelta(c.count, c.prevCount)} />
          )}
        </div>
      ))}
    </div>
  );
}
