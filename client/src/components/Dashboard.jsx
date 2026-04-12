import { useMemo, useState } from 'react';
import {
  PERIODS,
  getPeriodRange,
  filterEventsInRange,
  defaultGranularity,
  bucketEvents,
} from '../utils/timeAgg.js';
import KpiStrip from './dashboard/KpiStrip.jsx';
import PeriodSummary from './dashboard/PeriodSummary.jsx';
import ActivityChart from './dashboard/ActivityChart.jsx';
import CalendarHeatmap from './dashboard/CalendarHeatmap.jsx';
import TopFriendsBar from './dashboard/TopFriendsBar.jsx';
import RecencyHistogram from './dashboard/RecencyHistogram.jsx';
import CumulativeFriends from './dashboard/CumulativeFriends.jsx';
import SoloVsGroupDonut from './dashboard/SoloVsGroupDonut.jsx';

export default function Dashboard({ friends, events, onSelectFriend }) {
  const [period, setPeriod] = useState('month');

  const range = useMemo(() => getPeriodRange(period), [period]);
  const prevRange = useMemo(() => {
    if (range.prevStart == null) return null;
    return { start: range.prevStart, end: range.prevEnd };
  }, [range]);

  const periodEvents = useMemo(
    () =>
      filterEventsInRange(
        events,
        range.start === -Infinity ? 0 : range.start,
        range.end
      ),
    [events, range]
  );

  const prevPeriodEvents = useMemo(() => {
    if (!prevRange) return [];
    return filterEventsInRange(events, prevRange.start, prevRange.end);
  }, [events, prevRange]);

  const granularity = defaultGranularity(period);

  // For 'all', start the bucket window at the earliest event so the chart
  // doesn't try to render from epoch zero.
  const chartStart = useMemo(() => {
    if (range.start !== -Infinity) return range.start;
    if (events.length === 0) return Date.now() - 365 * 86400000;
    return Math.min(
      ...events.map((e) => {
        const [y, m, d] = e.date.split('-').map(Number);
        return new Date(y, m - 1, d).getTime();
      })
    );
  }, [events, range]);

  const buckets = useMemo(
    () => bucketEvents(periodEvents, granularity, chartStart, range.end),
    [periodEvents, granularity, chartStart, range.end]
  );

  const showHeatmap = period === 'year' || period === 'ytd' || period === 'all';

  return (
    <div className="dashboard">
      <div className="dashboard-toolbar">
        <div className="dashboard-period-label">{range.label}</div>
        <div className="period-selector">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              className={`period-btn ${period === p.id ? 'active' : ''}`}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <KpiStrip
        events={periodEvents}
        prevEvents={prevPeriodEvents}
        hasPrev={prevRange != null}
      />

      <PeriodSummary events={events} />

      <div className="dashboard-grid">
        <div className="dashboard-card dashboard-card-wide">
          <div className="dashboard-card-title">
            Activity over time
            <span className="dashboard-card-sub">
              solo vs group · {granularity === 'day' ? 'daily' : granularity === 'week' ? 'weekly' : 'monthly'}
            </span>
          </div>
          <ActivityChart buckets={buckets} granularity={granularity} />
        </div>

        {showHeatmap && (
          <div className="dashboard-card dashboard-card-wide">
            <div className="dashboard-card-title">
              Calendar heatmap
              <span className="dashboard-card-sub">
                events per day
              </span>
            </div>
            <CalendarHeatmap events={periodEvents} start={chartStart} end={range.end} />
          </div>
        )}

        <div className="dashboard-card">
          <div className="dashboard-card-title">
            Top friends
            <span className="dashboard-card-sub">in period</span>
          </div>
          <TopFriendsBar
            events={periodEvents}
            friends={friends}
            onSelectFriend={onSelectFriend}
          />
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-title">
            Solo vs group
            <span className="dashboard-card-sub">in period</span>
          </div>
          <SoloVsGroupDonut events={periodEvents} />
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-title">
            Recency
            <span className="dashboard-card-sub">days since last hangout</span>
          </div>
          <RecencyHistogram friends={friends} />
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-title">
            Friends added
            <span className="dashboard-card-sub">cumulative</span>
          </div>
          <CumulativeFriends friends={friends} />
        </div>
      </div>
    </div>
  );
}
