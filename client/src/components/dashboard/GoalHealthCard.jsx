import { useMemo } from 'react';
import {
  goalStatus,
  goalSummary,
  goalStatusColor,
  cadenceLabel,
} from '../../utils/timeAgg.js';

export default function GoalHealthCard({ friends, onSelectFriend }) {
  const withGoals = useMemo(() => {
    return friends
      .filter((f) => f.cadence_days)
      .map((f) => ({ friend: f, status: goalStatus(f) }))
      .sort((a, b) => b.status.ratio - a.status.ratio);
  }, [friends]);

  const summary = useMemo(() => goalSummary(friends), [friends]);

  if (withGoals.length === 0) {
    return (
      <div className="goal-health-empty">
        <span className="goal-health-empty-text">
          Set cadence goals from any friend's panel
        </span>
      </div>
    );
  }

  return (
    <div className="goal-health-card">
      <div className="goal-chips">
        {summary.ontrack > 0 && (
          <span className="goal-chip" style={{ color: '#34d399' }}>
            {summary.ontrack} on track
          </span>
        )}
        {summary.due > 0 && (
          <span className="goal-chip" style={{ color: '#fbbf24' }}>
            {summary.due} due soon
          </span>
        )}
        {summary.overdue > 0 && (
          <span className="goal-chip" style={{ color: '#f97316' }}>
            {summary.overdue} overdue
          </span>
        )}
        {summary.critical > 0 && (
          <span className="goal-chip" style={{ color: '#f87171' }}>
            {summary.critical} critical
          </span>
        )}
      </div>
      <div className="goal-list">
        {withGoals.map(({ friend, status }) => (
          <button
            key={friend.id}
            className="goal-row"
            onClick={() => onSelectFriend && onSelectFriend(friend)}
          >
            <span
              className="goal-dot"
              style={{ background: goalStatusColor(status.state) }}
            />
            <span className="goal-name">{friend.name}</span>
            <span className="goal-cadence">{cadenceLabel(friend.cadence_days)}</span>
            <span
              className="goal-status-label"
              style={{ color: goalStatusColor(status.state) }}
            >
              {status.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
