import { exportData } from '../api.js';

export default function Header({ friends, events, onLogHangout, onLogout }) {
  const totalEvents = events.length;
  const friendCount = friends.length;

  const mostSeen = friends.reduce(
    (best, f) => (f.total_events > (best?.total_events || 0) ? f : best),
    null
  );

  const needsAttention = friends.filter((f) => {
    if (!f.last_seen) return true;
    const days = Math.floor((Date.now() - new Date(f.last_seen)) / 86400000);
    return days >= 30;
  });

  const handleExport = async () => {
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `social-orbit-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  return (
    <>
      <div className="header glass">
        <div className="header-left">
          <span className="header-title">&#x2B21; Social Orbit</span>
          <div className="header-stats">
            <span className="stat-pill">
              <span className="stat-value">{totalEvents}</span> events
            </span>
            <span className="stat-pill">
              <span className="stat-value">{friendCount}</span> friends
            </span>
            {mostSeen && (
              <span className="stat-pill">
                most seen: <span className="stat-value">{mostSeen.name}</span>
              </span>
            )}
            {needsAttention.length > 0 && (
              <span className="stat-pill" style={{ borderColor: 'rgba(251, 191, 36, 0.3)' }}>
                <span className="stat-value" style={{ color: 'var(--yellow)' }}>
                  {needsAttention.length}
                </span>{' '}
                need attention
              </span>
            )}
          </div>
        </div>
        <div className="header-right">
          <button className="btn btn-ghost" onClick={handleExport} title="Export data">
            &#x2913; Export
          </button>
          <button className="btn btn-primary" onClick={onLogHangout}>
            + Log Hangout
          </button>
          <button className="btn btn-ghost" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
      {needsAttention.length > 0 && (
        <div className="attention-bar">
          &#x26A0; Haven't seen:{' '}
          {needsAttention.map((f) => f.name).join(', ')}
        </div>
      )}
    </>
  );
}
