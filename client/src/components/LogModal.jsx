import { useState } from 'react';
import { createEvent, createFriend } from '../api.js';

export default function LogModal({ friends, onClose, onRefresh }) {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [type, setType] = useState('1on1');
  const [selectedIds, setSelectedIds] = useState([]);
  const [notes, setNotes] = useState('');
  const [newFriendName, setNewFriendName] = useState('');
  const [nlInput, setNlInput] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleFriend = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAddFriend = async () => {
    if (!newFriendName.trim()) return;
    try {
      const friend = await createFriend(newFriendName.trim());
      setSelectedIds((prev) => [...prev, friend.id]);
      setNewFriendName('');
      onRefresh();
    } catch {
      // ignore
    }
  };

  const handleNlInput = (text) => {
    setNlInput(text);
    if (!text.trim()) return;

    // Simple name matching
    const lower = text.toLowerCase();
    const matched = friends.filter((f) => lower.includes(f.name.toLowerCase()));
    if (matched.length > 0) {
      setSelectedIds(matched.map((f) => f.id));
      if (matched.length === 1) {
        setType('1on1');
      } else {
        setType('group');
      }
    }

    // Try to extract notes (the non-name part)
    let remaining = text;
    for (const f of matched) {
      remaining = remaining.replace(new RegExp(f.name, 'gi'), '').trim();
    }
    // Clean up common words
    remaining = remaining
      .replace(/\b(with|and|,)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (remaining) {
      setNotes(remaining);
    }
  };

  const handleSubmit = async () => {
    if (selectedIds.length === 0) return;
    setSaving(true);
    try {
      await createEvent({
        date,
        type,
        friendIds: selectedIds,
        notes: notes || null,
      });
      onRefresh();
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>Log Hangout</h2>

        <div className="nl-input">
          <input
            type="text"
            placeholder='Try: "dinner with Alex and Jordan"'
            value={nlInput}
            onChange={(e) => handleNlInput(e.target.value)}
          />
          <div className="hint">Type naturally to auto-fill, or use the form below</div>
        </div>

        <div className="modal-field">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="modal-field">
          <label>Type</label>
          <div className="type-toggle">
            <button
              className={type === '1on1' ? 'active' : ''}
              onClick={() => setType('1on1')}
            >
              1-on-1
            </button>
            <button
              className={type === 'group' ? 'active' : ''}
              onClick={() => setType('group')}
            >
              Group
            </button>
          </div>
        </div>

        <div className="modal-field">
          <label>Friends</label>
          <div className="friend-chips">
            {friends.map((f) => (
              <button
                key={f.id}
                className={`friend-chip ${selectedIds.includes(f.id) ? 'selected' : ''}`}
                onClick={() => toggleFriend(f.id)}
              >
                {f.name}
              </button>
            ))}
          </div>
          <div className="add-friend-inline">
            <input
              type="text"
              placeholder="Add new friend..."
              value={newFriendName}
              onChange={(e) => setNewFriendName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddFriend()}
            />
            <button className="btn btn-ghost" onClick={handleAddFriend}>
              Add
            </button>
          </div>
        </div>

        <div className="modal-field">
          <label>Notes (optional)</label>
          <textarea
            rows={3}
            placeholder="What did you do?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={saving || selectedIds.length === 0}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
