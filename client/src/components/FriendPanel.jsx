import { useState, useEffect } from 'react';
import { getEvents, deleteEvent, deleteFriend } from '../api.js';

function getRecencyColor(lastSeen) {
  if (!lastSeen) return '#f87171';
  const days = Math.floor((Date.now() - new Date(lastSeen)) / 86400000);
  if (days <= 15) return '#34d399';
  if (days <= 30) return '#fbbf24';
  if (days <= 60) return '#f97316';
  return '#f87171';
}

export default function FriendPanel({ friend, onClose, onRefresh }) {
  const [events, setEvents] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!friend) return;
    setConfirmDelete(false);
    getEvents(friend.id).then(setEvents).catch(() => {});
  }, [friend]);

  const handleDeleteFriend = async () => {
    await deleteFriend(friend.id);
    onClose();
    onRefresh();
  };

  const handleDeleteEvent = async (eventId) => {
    await deleteEvent(eventId);
    onRefresh();
    // Refresh event list
    const updated = await getEvents(friend.id);
    setEvents(updated);
  };

  const lastSeenText = friend?.last_seen
    ? (() => {
        const days = Math.floor((Date.now() - new Date(friend.last_seen)) / 86400000);
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        return `${days} days ago`;
      })()
    : 'Never';

  return (
    <div className={`friend-panel ${friend ? 'open' : ''}`}>
      {friend && (
        <>
          <div className="panel-header">
            <h2>{friend.name}</h2>
            <button className="panel-close" onClick={onClose}>
              &#x2715;
            </button>
          </div>

          <div
            className="panel-color-bar"
            style={{ background: getRecencyColor(friend.last_seen) }}
          />

          <div className="panel-stats">
            <div className="panel-stat">
              <div className="panel-stat-label">Last Seen</div>
              <div className="panel-stat-value">{lastSeenText}</div>
            </div>
            <div className="panel-stat">
              <div className="panel-stat-label">Closeness</div>
              <div className="panel-stat-value">{(friend.score || 0).toFixed(1)}</div>
            </div>
            <div className="panel-stat">
              <div className="panel-stat-label">Total Hangouts</div>
              <div className="panel-stat-value">{friend.total_events || 0}</div>
            </div>
            <div className="panel-stat">
              <div className="panel-stat-label">Solo / Group</div>
              <div className="panel-stat-value">
                {friend.solo_count || 0} / {friend.group_count || 0}
              </div>
            </div>
          </div>

          <div className="panel-section-title">Event History</div>

          {events.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
              No events yet
            </p>
          )}

          {events.map((evt) => (
            <div key={evt.id} className="panel-event">
              <div className="panel-event-header">
                <div>
                  <span className="panel-event-date">{evt.date}</span>
                  <span className="panel-event-type">{evt.type}</span>
                </div>
                <button
                  className="panel-event-delete"
                  onClick={() => handleDeleteEvent(evt.id)}
                  title="Delete event"
                >
                  &#x2715;
                </button>
              </div>
              {evt.notes && <div className="panel-event-notes">{evt.notes}</div>}
              {evt.friends && evt.friends.length > 0 && (
                <div className="panel-event-friends">
                  with {evt.friends.map((f) => f.name).join(', ')}
                </div>
              )}
            </div>
          ))}

          <div className="panel-danger-zone">
            {!confirmDelete ? (
              <button
                className="btn btn-danger"
                onClick={() => setConfirmDelete(true)}
              >
                Delete Friend
              </button>
            ) : (
              <div className="confirm-delete">
                <p>
                  Are you sure you want to remove <strong>{friend.name}</strong>? This will also
                  delete all their event associations.
                </p>
                <div className="confirm-delete-actions">
                  <button className="btn btn-danger" onClick={handleDeleteFriend}>
                    Yes, remove
                  </button>
                  <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
