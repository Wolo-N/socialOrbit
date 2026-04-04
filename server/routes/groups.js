import { Router } from 'express';
import db from '../db.js';

const router = Router();

// List all saved groups with members
router.get('/', (req, res) => {
  const groups = db.prepare('SELECT * FROM friend_groups ORDER BY name').all();
  const getMembers = db.prepare(
    'SELECT f.id, f.name FROM friends f JOIN friend_group_members gm ON gm.friend_id = f.id WHERE gm.group_id = ?'
  );
  const result = groups.map((g) => ({
    ...g,
    members: getMembers.all(g.id),
  }));
  res.json(result);
});

// Get suggested groups (from events, not yet saved or dismissed)
router.get('/suggestions', (req, res) => {
  const groupEvents = db.prepare("SELECT id FROM events WHERE type = 'group'").all();
  const getEventFriends = db.prepare(
    'SELECT f.id, f.name FROM friends f JOIN event_friends ef ON ef.friend_id = f.id WHERE ef.event_id = ? ORDER BY f.id'
  );
  const dismissed = new Set(
    db.prepare('SELECT key FROM dismissed_group_suggestions').all().map((r) => r.key)
  );
  const savedGroups = db.prepare('SELECT id FROM friend_groups').all();
  const getSavedMembers = db.prepare(
    'SELECT friend_id FROM friend_group_members WHERE group_id = ? ORDER BY friend_id'
  );
  const savedKeys = new Set(
    savedGroups.map((g) => getSavedMembers.all(g.id).map((m) => m.friend_id).join('-'))
  );

  const seen = new Map();
  for (const evt of groupEvents) {
    const friends = getEventFriends.all(evt.id);
    if (friends.length < 2) continue;
    const key = friends.map((f) => f.id).join('-');
    if (dismissed.has(key) || savedKeys.has(key)) continue;
    if (!seen.has(key)) {
      seen.set(key, { key, members: friends, count: 1 });
    } else {
      seen.get(key).count++;
    }
  }

  const suggestions = Array.from(seen.values()).sort((a, b) => b.count - a.count);
  res.json(suggestions);
});

// Create a group
router.post('/', (req, res) => {
  const { name, friendIds } = req.body;
  if (!name || !friendIds || friendIds.length < 2) {
    return res.status(400).json({ error: 'Name and at least 2 friends required' });
  }

  const result = db.prepare('INSERT INTO friend_groups (name) VALUES (?)').run(name);
  const groupId = Number(result.lastInsertRowid);
  const insertMember = db.prepare('INSERT INTO friend_group_members (group_id, friend_id) VALUES (?, ?)');
  for (const fid of friendIds) {
    insertMember.run(groupId, fid);
  }

  res.json({ id: groupId, name, members: friendIds });
});

// Rename a group
router.put('/:id', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  db.prepare('UPDATE friend_groups SET name = ? WHERE id = ?').run(name, req.params.id);
  res.json({ success: true });
});

// Delete a group
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM friend_groups WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// Dismiss a suggestion
router.post('/dismiss', (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'Key required' });
  db.prepare('INSERT OR IGNORE INTO dismissed_group_suggestions (key) VALUES (?)').run(key);
  res.json({ success: true });
});

export default router;
