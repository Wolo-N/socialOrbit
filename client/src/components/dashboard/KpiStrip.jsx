import {
  uniqueFriendsSeen,
  avgGapDays,
  soloGroupSplit,
  pctDelta,
} from '../../utils/timeAgg.js';

function Delta({ value }) {
  if (value == null || !isFinite(value)) return <span className="kpi-delta neutral">—</span>;
  if (Math.abs(value) < 0.5) return <span className="kpi-delta neutral">±0%</span>;
  const up = value > 0;
  return (
    <span className={`kpi-delta ${up ? 'up' : 'down'}`}>
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(0)}%
    </span>
  );
}

export default function KpiStrip({ events, prevEvents, hasPrev }) {
  const total = events.length;
  const unique = uniqueFriendsSeen(events);
  const split = soloGroupSplit(events);
  const gap = avgGapDays(events);

  const prevTotal = prevEvents.length;
  const prevUnique = uniqueFriendsSeen(prevEvents);
  const prevGap = avgGapDays(prevEvents);

  return (
    <div className="kpi-strip">
      <div className="kpi-card glass">
        <div className="kpi-label">Events</div>
        <div className="kpi-value">{total}</div>
        {hasPrev && <Delta value={pctDelta(total, prevTotal)} />}
      </div>
      <div className="kpi-card glass">
        <div className="kpi-label">Unique friends</div>
        <div className="kpi-value">{unique}</div>
        {hasPrev && <Delta value={pctDelta(unique, prevUnique)} />}
      </div>
      <div className="kpi-card glass">
        <div className="kpi-label">Solo / Group</div>
        <div className="kpi-value">
          {split.solo} <span className="kpi-sep">/</span> {split.group}
        </div>
        <div className="kpi-sub">
          {split.total > 0 ? `${Math.round((split.solo / split.total) * 100)}% solo` : '—'}
        </div>
      </div>
      <div className="kpi-card glass">
        <div className="kpi-label">Avg gap</div>
        <div className="kpi-value">
          {gap == null ? '—' : `${gap.toFixed(1)}d`}
        </div>
        {hasPrev && gap != null && prevGap != null && (
          <Delta value={pctDelta(gap, prevGap)} />
        )}
      </div>
    </div>
  );
}
