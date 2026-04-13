import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const friends = db.prepare(`
    SELECT f.id, f.name, f.created_at,
      s.score, s.last_seen, s.total_events,
      s.solo_count, s.group_count,
      g.cadence_days
    FROM friends f
    LEFT JOIN scores s ON s.friend_id = f.id
    LEFT JOIN friend_goals g ON g.friend_id = f.id
    ORDER BY f.name ASC
  `).all();
  res.json(friends);
});

router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  const result = db.prepare('INSERT INTO friends (name) VALUES (?)').run(name.trim());
  const friendId = Number(result.lastInsertRowid);
  const today = new Date().toISOString().split('T')[0];
  db.prepare(
    'INSERT INTO scores (friend_id, score, last_seen, total_events, solo_count, group_count, last_decay_date) VALUES (?, 0, NULL, 0, 0, 0, ?)'
  ).run(friendId, today);
  const friend = db.prepare(`
    SELECT f.id, f.name, f.created_at,
      s.score, s.last_seen, s.total_events,
      s.solo_count, s.group_count
    FROM friends f
    LEFT JOIN scores s ON s.friend_id = f.id
    WHERE f.id = ?
  `).get(friendId);
  res.status(201).json(friend);
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM friends WHERE id = ?').run(id);
  res.status(204).end();
});

export default router;
