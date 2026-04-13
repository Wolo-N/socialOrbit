import { Router } from 'express';
import db from '../db.js';

const router = Router();

// List every goal — keyed by friend_id for convenience.
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT friend_id, cadence_days, created_at FROM friend_goals').all();
  res.json(rows);
});

// Upsert a goal for a friend.
router.put('/:friendId', (req, res) => {
  const friendId = Number(req.params.friendId);
  const cadence = Number(req.body?.cadence_days);

  if (!Number.isFinite(friendId)) {
    return res.status(400).json({ error: 'Invalid friendId' });
  }
  if (!Number.isFinite(cadence) || cadence < 1 || cadence > 3650) {
    return res.status(400).json({ error: 'cadence_days must be 1–3650' });
  }

  const friend = db.prepare('SELECT id FROM friends WHERE id = ?').get(friendId);
  if (!friend) return res.status(404).json({ error: 'Friend not found' });

  db.prepare(
    `INSERT INTO friend_goals (friend_id, cadence_days)
     VALUES (?, ?)
     ON CONFLICT(friend_id) DO UPDATE SET cadence_days = excluded.cadence_days`
  ).run(friendId, cadence);

  const goal = db
    .prepare('SELECT friend_id, cadence_days, created_at FROM friend_goals WHERE friend_id = ?')
    .get(friendId);
  res.json(goal);
});

router.delete('/:friendId', (req, res) => {
  const friendId = Number(req.params.friendId);
  if (!Number.isFinite(friendId)) {
    return res.status(400).json({ error: 'Invalid friendId' });
  }
  db.prepare('DELETE FROM friend_goals WHERE friend_id = ?').run(friendId);
  res.status(204).end();
});

export default router;
