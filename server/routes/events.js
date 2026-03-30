import { Router } from 'express';
import db from '../db.js';
import { bumpScore, recalculateScores } from '../decay.js';

const router = Router();

router.get('/', (req, res) => {
  const { friendId } = req.query;

  let events;
  if (friendId) {
    events = db.prepare(`
      SELECT DISTINCT e.* FROM events e
      JOIN event_friends ef ON ef.event_id = e.id
      WHERE ef.friend_id = ?
      ORDER BY e.date DESC
    `).all(friendId);
  } else {
    events = db.prepare('SELECT * FROM events ORDER BY date DESC').all();
  }

  // Attach friends to each event
  const getFriends = db.prepare(`
    SELECT f.id, f.name FROM friends f
    JOIN event_friends ef ON ef.friend_id = f.id
    WHERE ef.event_id = ?
  `);

  const result = events.map((evt) => ({
    ...evt,
    friends: getFriends.all(evt.id),
  }));

  res.json(result);
});

router.post('/', (req, res) => {
  const { date, type, friendIds, notes } = req.body;

  if (!date || !type || !friendIds || !friendIds.length) {
    return res.status(400).json({ error: 'date, type, and friendIds are required' });
  }
  if (!['1on1', 'group'].includes(type)) {
    return res.status(400).json({ error: 'type must be 1on1 or group' });
  }

  const tx = db.transaction(() => {
    const result = db.prepare('INSERT INTO events (date, type, notes) VALUES (?, ?, ?)').run(
      date,
      type,
      notes || null
    );
    const eventId = Number(result.lastInsertRowid);

    const insertEF = db.prepare('INSERT INTO event_friends (event_id, friend_id) VALUES (?, ?)');
    for (const fid of friendIds) {
      insertEF.run(eventId, fid);
      bumpScore(db, fid, type, date);
    }

    const getFriends = db.prepare(`
      SELECT f.id, f.name FROM friends f
      JOIN event_friends ef ON ef.friend_id = f.id
      WHERE ef.event_id = ?
    `);

    return {
      id: eventId,
      date,
      type,
      notes: notes || null,
      friends: getFriends.all(eventId),
    };
  });

  const event = tx();
  res.status(201).json(event);
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;

  // Get affected friend IDs before deleting
  const affectedFriends = db
    .prepare('SELECT friend_id FROM event_friends WHERE event_id = ?')
    .all(id)
    .map((r) => r.friend_id);

  db.prepare('DELETE FROM events WHERE id = ?').run(id);

  // Recalculate scores for affected friends
  for (const friendId of affectedFriends) {
    recalculateScores(db, friendId);
  }

  res.status(204).end();
});

export default router;
