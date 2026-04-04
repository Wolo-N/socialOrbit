import { useRef } from 'react';
import { exportData, importData } from '../api.js';

export default function Header({ friends, events, onLogHangout, onLogout, onRefresh }) {
  const fileInputRef = useRef(null);
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
      const d = new Date();
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      a.download = `social-orbit-export-${dd}-${mm}-${yyyy}.json`;
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
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const text = await file.text();
                const data = JSON.parse(text);
                if (!data.friends || !data.events || !data.eventFriends || !data.scores) {
                  alert('Invalid export file.');
                  return;
                }
                if (!confirm('This will replace all current data. Continue?')) return;
                await importData(data);
                if (onRefresh) onRefresh();
              } catch {
                alert('Failed to import data.');
              }
              e.target.value = '';
            }}
          />
          <button className="btn btn-ghost" onClick={() => fileInputRef.current?.click()} title="Import data">
            &#x2912; Import
          </button>
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
