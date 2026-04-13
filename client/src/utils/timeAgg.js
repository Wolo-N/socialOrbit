// Time-aggregation helpers used by the Dashboard.
// Pure functions — no React, no D3, fully testable.

const DAY_MS = 86400000;

export const PERIODS = [
  { id: 'week',  label: 'Week',  days: 7 },
  { id: 'month', label: 'Month', days: 30 },
  { id: 'year',  label: 'Year',  days: 365 },
  { id: 'ytd',   label: 'YTD' },
  { id: 'all',   label: 'All' },
];

// Recency color thresholds — single source of truth, mirrors Graph.jsx.
export const RECENCY_TIERS = [
  { max:  15, color: '#34d399', label: '0–15d',  varName: '--green'  },
  { max:  30, color: '#fbbf24', label: '16–30d', varName: '--yellow' },
  { max:  60, color: '#f97316', label: '31–60d', varName: '--orange' },
  { max: 999, color: '#f87171', label: '60d+',   varName: '--red'    },
];

export function daysSinceLastSeen(friend, now = Date.now()) {
  if (!friend?.last_seen) return null;
  return Math.floor((now - new Date(friend.last_seen).getTime()) / DAY_MS);
}

export function getRecencyColor(lastSeen, now = Date.now()) {
  if (!lastSeen) return '#f87171';
  const days = Math.floor((now - new Date(lastSeen).getTime()) / DAY_MS);
  for (const tier of RECENCY_TIERS) {
    if (days <= tier.max) return tier.color;
  }
  return '#f87171';
}

// Returns { start, end, prevStart, prevEnd, label } for the active period.
// All times are JS timestamps (ms). `end` is the current moment.
export function getPeriodRange(period, now = Date.now()) {
  const nowDate = new Date(now);
  if (period === 'week') {
    const days = 7;
    return {
      start: now - days * DAY_MS,
      end: now,
      prevStart: now - 2 * days * DAY_MS,
      prevEnd: now - days * DAY_MS,
      label: 'Last 7 days',
    };
  }
  if (period === 'month') {
    const days = 30;
    return {
      start: now - days * DAY_MS,
      end: now,
      prevStart: now - 2 * days * DAY_MS,
      prevEnd: now - days * DAY_MS,
      label: 'Last 30 days',
    };
  }
  if (period === 'year') {
    const days = 365;
    return {
      start: now - days * DAY_MS,
      end: now,
      prevStart: now - 2 * days * DAY_MS,
      prevEnd: now - days * DAY_MS,
      label: 'Last 365 days',
    };
  }
  if (period === 'ytd') {
    const start = new Date(nowDate.getFullYear(), 0, 1).getTime();
    const prevYearStart = new Date(nowDate.getFullYear() - 1, 0, 1).getTime();
    // Prev YTD = same span Jan 1 → today-1y
    const prevYearEnd = prevYearStart + (now - start);
    return {
      start,
      end: now,
      prevStart: prevYearStart,
      prevEnd: prevYearEnd,
      label: `${nowDate.getFullYear()} YTD`,
    };
  }
  // 'all'
  return {
    start: -Infinity,
    end: now,
    prevStart: null,
    prevEnd: null,
    label: 'All time',
  };
}

// Convert event.date (YYYY-MM-DD) to a stable midnight timestamp.
export function eventTime(evt) {
  // Parse manually to avoid timezone surprises with new Date('YYYY-MM-DD')
  // which is interpreted as UTC midnight.
  const [y, m, d] = evt.date.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function filterEventsInRange(events, start, end) {
  return events.filter((e) => {
    const t = eventTime(e);
    return t >= start && t <= end;
  });
}

// Choose a sensible bucket granularity for a given period.
export function defaultGranularity(period) {
  if (period === 'week') return 'day';
  if (period === 'month') return 'day';
  if (period === 'year') return 'week';
  if (period === 'ytd') return 'week';
  return 'month';
}

function startOfDay(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function startOfWeek(t) {
  // ISO-ish: week starts on Monday
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d.getTime();
}
function startOfMonth(t) {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function bucketStart(t, granularity) {
  if (granularity === 'day') return startOfDay(t);
  if (granularity === 'week') return startOfWeek(t);
  return startOfMonth(t);
}

function nextBucket(t, granularity) {
  const d = new Date(t);
  if (granularity === 'day') {
    d.setDate(d.getDate() + 1);
  } else if (granularity === 'week') {
    d.setDate(d.getDate() + 7);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d.getTime();
}

// Bucket events into time buckets, filling empty buckets with zeros.
// `start` and `end` define the visible window so empty trailing buckets render.
export function bucketEvents(events, granularity, start, end) {
  const map = new Map(); // bucketStart → { solo, group }
  for (const e of events) {
    const b = bucketStart(eventTime(e), granularity);
    const cur = map.get(b) || { solo: 0, group: 0 };
    if (e.type === '1on1') cur.solo += 1;
    else cur.group += 1;
    map.set(b, cur);
  }

  // Fill the visible range so the chart has continuous bars.
  const buckets = [];
  let cursor = bucketStart(start, granularity);
  const stop = end;
  // Safety cap so a misconfigured 'all' range can't blow up.
  let safety = 600;
  while (cursor <= stop && safety-- > 0) {
    const v = map.get(cursor) || { solo: 0, group: 0 };
    buckets.push({
      bucket: new Date(cursor),
      solo: v.solo,
      group: v.group,
      total: v.solo + v.group,
    });
    cursor = nextBucket(cursor, granularity);
  }
  return buckets;
}

// Top friends by event count within `events` (already filtered to a period).
export function topFriendsByEvents(events, friends, limit = 10) {
  const counts = new Map();
  for (const e of events) {
    if (!e.friends) continue;
    for (const f of e.friends) {
      counts.set(f.id, (counts.get(f.id) || 0) + 1);
    }
  }
  const friendMap = new Map(friends.map((f) => [f.id, f]));
  return [...counts.entries()]
    .map(([id, count]) => ({ friend: friendMap.get(id) || { id, name: '?' }, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// Number of unique friends seen in `events`.
export function uniqueFriendsSeen(events) {
  const ids = new Set();
  for (const e of events) {
    if (!e.friends) continue;
    for (const f of e.friends) ids.add(f.id);
  }
  return ids.size;
}

// Average days between consecutive events (sorted by date).
export function avgGapDays(events) {
  if (events.length < 2) return null;
  const times = events.map(eventTime).sort((a, b) => a - b);
  let sum = 0;
  for (let i = 1; i < times.length; i++) sum += times[i] - times[i - 1];
  return sum / (times.length - 1) / DAY_MS;
}

// Solo / group split inside `events`.
export function soloGroupSplit(events) {
  let solo = 0;
  let group = 0;
  for (const e of events) {
    if (e.type === '1on1') solo += 1;
    else group += 1;
  }
  return { solo, group, total: solo + group };
}

// Histogram of "days since last seen" across all friends.
export function recencyBuckets(friends, now = Date.now()) {
  const bins = [
    { label: '0–7d',   min: 0,  max: 7,  color: '#34d399', count: 0 },
    { label: '8–15d',  min: 8,  max: 15, color: '#34d399', count: 0 },
    { label: '16–30d', min: 16, max: 30, color: '#fbbf24', count: 0 },
    { label: '31–60d', min: 31, max: 60, color: '#f97316', count: 0 },
    { label: '61–90d', min: 61, max: 90, color: '#f87171', count: 0 },
    { label: '90d+',   min: 91, max: Infinity, color: '#f87171', count: 0 },
    { label: 'never',  min: -1, max: -1, color: '#64748b', count: 0 },
  ];
  for (const f of friends) {
    const d = daysSinceLastSeen(f, now);
    if (d === null) {
      bins[bins.length - 1].count += 1;
      continue;
    }
    for (const bin of bins) {
      if (d >= bin.min && d <= bin.max) {
        bin.count += 1;
        break;
      }
    }
  }
  return bins;
}

// Cumulative friend count over time, derived from friends.created_at.
export function cumulativeFriendCounts(friends) {
  const sorted = [...friends]
    .filter((f) => f.created_at)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  let count = 0;
  return sorted.map((f) => {
    count += 1;
    return { date: new Date(f.created_at), count };
  });
}

// Friends not seen in 30+ days (mirrors Header.jsx logic).
export function needsAttention(friends, now = Date.now()) {
  return friends.filter((f) => {
    if (!f.last_seen) return true;
    return Math.floor((now - new Date(f.last_seen).getTime()) / DAY_MS) >= 30;
  });
}

// Format a JS Date as a short label appropriate for a bucket granularity.
export function formatBucketLabel(date, granularity) {
  const opts =
    granularity === 'month'
      ? { month: 'short', year: '2-digit' }
      : { month: 'short', day: 'numeric' };
  return date.toLocaleDateString(undefined, opts);
}

// Percentage delta helper. Returns null if previous is 0 (avoid div-by-zero).
export function pctDelta(current, previous) {
  if (previous === 0 || previous == null) return null;
  return ((current - previous) / previous) * 100;
}

// ─── Cadence Goals ───

export const CADENCE_PRESETS = [
  { label: 'Weekly', days: 7 },
  { label: 'Bi-weekly', days: 14 },
  { label: 'Monthly', days: 30 },
  { label: 'Quarterly', days: 90 },
];

export function cadenceLabel(days) {
  const preset = CADENCE_PRESETS.find((p) => p.days === days);
  if (preset) return preset.label;
  return `Every ${days}d`;
}

const GOAL_COLORS = {
  ontrack: '#34d399',
  due: '#fbbf24',
  overdue: '#f97316',
  critical: '#f87171',
};

export function goalStatusColor(state) {
  return GOAL_COLORS[state] || '#64748b';
}

export function goalStatus(friend, now = Date.now()) {
  if (!friend?.cadence_days) return null;
  const days = daysSinceLastSeen(friend, now);
  if (days === null) {
    return { state: 'critical', ratio: Infinity, daysUntilDue: -Infinity, label: 'never seen' };
  }
  const ratio = days / friend.cadence_days;
  const daysUntilDue = friend.cadence_days - days;
  let state;
  if (ratio < 0.7) state = 'ontrack';
  else if (ratio < 1.0) state = 'due';
  else if (ratio < 1.5) state = 'overdue';
  else state = 'critical';

  let label;
  if (daysUntilDue > 0) label = `${daysUntilDue}d left`;
  else if (daysUntilDue === 0) label = 'due today';
  else label = `${Math.abs(daysUntilDue)}d overdue`;

  return { state, ratio, daysUntilDue, label };
}

export function goalSummary(friends, now = Date.now()) {
  const result = { ontrack: 0, due: 0, overdue: 0, critical: 0, total: 0 };
  for (const f of friends) {
    const s = goalStatus(f, now);
    if (!s) continue;
    result[s.state] += 1;
    result.total += 1;
  }
  return result;
}
