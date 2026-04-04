import { useState, useEffect } from 'react';
import {
  createEvent,
  createFriend,
  getGroups,
  getGroupSuggestions,
  createGroup,
  renameGroup,
  deleteGroup,
  dismissGroupSuggestion,
} from '../api.js';

export default function LogModal({ friends, events = [], onClose, onRefresh }) {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [type, setType] = useState('1on1');
  const [selectedIds, setSelectedIds] = useState([]);
  const [notes, setNotes] = useState('');
  const [newFriendName, setNewFriendName] = useState('');
  const [nlInput, setNlInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Groups
  const [groups, setGroups] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const [g, s] = await Promise.all([getGroups(), getGroupSuggestions()]);
      setGroups(g);
      setSuggestions(s);
    } catch {}
  };

  const toggleFriend = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectGroup = (memberIds) => {
    setSelectedIds((prev) => {
      const combined = new Set(prev);
      for (const id of memberIds) combined.add(id);
      return Array.from(combined);
    });
    setType('group');
  };

  const deselectGroup = (memberIds) => {
    setSelectedIds((prev) => prev.filter((id) => !memberIds.includes(id)));
  };

  const isGroupFullySelected = (memberIds) =>
    memberIds.every((id) => selectedIds.includes(id));

  const handleConfirmSuggestion = async (suggestion) => {
    const name = suggestion.members.map((m) => m.name).join(', ');
    await createGroup(name, suggestion.members.map((m) => m.id));
    await loadGroups();
  };

  const handleDismissSuggestion = async (suggestion) => {
    await dismissGroupSuggestion(suggestion.key);
    setSuggestions((prev) => prev.filter((s) => s.key !== suggestion.key));
  };

  const handleRenameGroup = async (groupId) => {
    if (!editingName.trim()) return;
    await renameGroup(groupId, editingName.trim());
    setEditingGroupId(null);
    await loadGroups();
  };

  const handleDeleteGroup = async (groupId) => {
    await deleteGroup(groupId);
    await loadGroups();
  };

  const handleAddFriend = async () => {
    if (!newFriendName.trim()) return;
    try {
      const friend = await createFriend(newFriendName.trim());
      setSelectedIds((prev) => [...prev, friend.id]);
      setNewFriendName('');
      onRefresh();
    } catch {}
  };

  const handleNlInput = (text) => {
    setNlInput(text);
    if (!text.trim()) return;
    const lower = text.toLowerCase();
    const matched = friends.filter((f) => lower.includes(f.name.toLowerCase()));
    if (matched.length > 0) {
      setSelectedIds(matched.map((f) => f.id));
      setType(matched.length === 1 ? '1on1' : 'group');
    }
    let remaining = text;
    for (const f of matched) {
      remaining = remaining.replace(new RegExp(f.name, 'gi'), '').trim();
    }
    remaining = remaining.replace(/\b(with|and|,)\b/gi, '').replace(/\s+/g, ' ').trim();
    if (remaining) setNotes(remaining);
  };

  const handleSubmit = async () => {
    if (selectedIds.length === 0) return;
    setSaving(true);
    try {
      await createEvent({ date, type, friendIds: selectedIds, notes: notes || null });
      onRefresh();
      onClose();
    } catch {
      setSaving(false);
    }
  };

  const showGroups = type === 'group';

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
            <button className={type === '1on1' ? 'active' : ''} onClick={() => setType('1on1')}>
              1-on-1
            </button>
            <button className={type === 'group' ? 'active' : ''} onClick={() => setType('group')}>
              Group
            </button>
          </div>
        </div>

        <div className="modal-field">
          <label>Friends</label>

          {showGroups && groups.length > 0 && (
            <>
              <div className="friend-chips-section-label">Saved Groups</div>
              <div className="group-tabs">
                {groups.map((group) => {
                  const memberIds = group.members.map((m) => m.id);
                  const isExpanded = expandedGroup === `g-${group.id}`;
                  const allSelected = isGroupFullySelected(memberIds);
                  const isEditing = editingGroupId === group.id;
                  return (
                    <div key={group.id} className="group-tab">
                      <div className="group-tab-header">
                        <button
                          className={`group-tab-toggle ${isExpanded ? 'expanded' : ''}`}
                          onClick={() => setExpandedGroup(isExpanded ? null : `g-${group.id}`)}
                        >
                          <span className="group-tab-arrow">{isExpanded ? '\u25BC' : '\u25B6'}</span>
                          <span className="group-tab-names">{group.name}</span>
                        </button>
                        <button
                          className={`btn btn-ghost group-select-btn ${allSelected ? 'selected' : ''}`}
                          onClick={() => allSelected ? deselectGroup(memberIds) : selectGroup(memberIds)}
                        >
                          {allSelected ? 'Deselect' : 'Select all'}
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="group-tab-body">
                          <div className="group-tab-members">
                            {group.members.map((m) => (
                              <button
                                key={m.id}
                                className={`friend-chip ${selectedIds.includes(m.id) ? 'selected' : ''}`}
                                onClick={() => toggleFriend(m.id)}
                              >
                                {m.name}
                              </button>
                            ))}
                          </div>
                          <div className="group-tab-actions">
                            {isEditing ? (
                              <div className="group-rename-row">
                                <input
                                  type="text"
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleRenameGroup(group.id)}
                                  autoFocus
                                />
                                <button className="btn btn-ghost" onClick={() => handleRenameGroup(group.id)}>Save</button>
                                <button className="btn btn-ghost" onClick={() => setEditingGroupId(null)}>Cancel</button>
                              </div>
                            ) : (
                              <>
                                <button
                                  className="btn btn-ghost group-action-btn"
                                  onClick={() => { setEditingGroupId(group.id); setEditingName(group.name); }}
                                >
                                  Rename
                                </button>
                                <button
                                  className="btn btn-ghost group-action-btn danger"
                                  onClick={() => handleDeleteGroup(group.id)}
                                >
                                  Delete group
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {showGroups && suggestions.length > 0 && (
            <>
              <div className="friend-chips-section-label">Suggested Groups</div>
              <div className="group-tabs">
                {suggestions.map((suggestion) => {
                  const memberIds = suggestion.members.map((m) => m.id);
                  const isExpanded = expandedGroup === `s-${suggestion.key}`;
                  const allSelected = isGroupFullySelected(memberIds);
                  return (
                    <div key={suggestion.key} className="group-tab suggestion">
                      <div className="group-tab-header">
                        <button
                          className={`group-tab-toggle ${isExpanded ? 'expanded' : ''}`}
                          onClick={() => setExpandedGroup(isExpanded ? null : `s-${suggestion.key}`)}
                        >
                          <span className="group-tab-arrow">{isExpanded ? '\u25BC' : '\u25B6'}</span>
                          <span className="group-tab-names">
                            {suggestion.members.map((m) => m.name).join(', ')}
                          </span>
                          <span className="group-tab-count">{suggestion.count}x</span>
                        </button>
                        <button
                          className={`btn btn-ghost group-select-btn ${allSelected ? 'selected' : ''}`}
                          onClick={() => allSelected ? deselectGroup(memberIds) : selectGroup(memberIds)}
                        >
                          {allSelected ? 'Deselect' : 'Select all'}
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="group-tab-body">
                          <div className="group-tab-members">
                            {suggestion.members.map((m) => (
                              <button
                                key={m.id}
                                className={`friend-chip ${selectedIds.includes(m.id) ? 'selected' : ''}`}
                                onClick={() => toggleFriend(m.id)}
                              >
                                {m.name}
                              </button>
                            ))}
                          </div>
                          <div className="group-tab-actions">
                            <button
                              className="btn btn-ghost group-action-btn confirm"
                              onClick={() => handleConfirmSuggestion(suggestion)}
                            >
                              Save as group
                            </button>
                            <button
                              className="btn btn-ghost group-action-btn"
                              onClick={() => handleDismissSuggestion(suggestion)}
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="friend-chips-section-label">All friends</div>
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
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
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
