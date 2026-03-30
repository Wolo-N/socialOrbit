const todayStr = () => new Date().toISOString().split('T')[0];

export function applyDecay(db) {
  const today = todayStr();
  const scores = db.prepare('SELECT * FROM scores').all();

  const update = db.prepare(
    'UPDATE scores SET score = ?, last_decay_date = ? WHERE friend_id = ?'
  );

  const tx = db.transaction(() => {
    for (const row of scores) {
      if (row.last_decay_date === today) continue;
      const lastDate = row.last_decay_date || today;
      const days = Math.floor((new Date(today) - new Date(lastDate)) / 86400000);
      if (days <= 0) continue;
      let newScore = row.score * Math.pow(0.98, days);
      newScore = Math.min(100, Math.max(0, newScore));
      update.run(newScore, today, row.friend_id);
    }
  });

  tx();
}

export function bumpScore(db, friendId, eventType, eventDate) {
  const bump = eventType === '1on1' ? 10 : 4;
  const soloInc = eventType === '1on1' ? 1 : 0;
  const groupInc = eventType === 'group' ? 1 : 0;

  const row = db.prepare('SELECT * FROM scores WHERE friend_id = ?').get(friendId);
  if (!row) return;

  let newScore = row.score + bump;
  newScore = Math.min(100, Math.max(0, newScore));

  const newLastSeen =
    !row.last_seen || eventDate > row.last_seen ? eventDate : row.last_seen;

  db.prepare(`
    UPDATE scores SET
      score = ?,
      last_seen = ?,
      total_events = total_events + 1,
      solo_count = solo_count + ?,
      group_count = group_count + ?
    WHERE friend_id = ?
  `).run(newScore, newLastSeen, soloInc, groupInc, friendId);
}

export function recalculateScores(db, friendId) {
  // Get all events for this friend, ordered by date
  const events = db.prepare(`
    SELECT e.date, e.type FROM events e
    JOIN event_friends ef ON ef.event_id = e.id
    WHERE ef.friend_id = ?
    ORDER BY e.date ASC
  `).all(friendId);

  let score = 0;
  let lastSeen = null;
  let totalEvents = 0;
  let soloCount = 0;
  let groupCount = 0;
  let lastDate = null;

  for (const evt of events) {
    // Decay since last event
    if (lastDate) {
      const days = Math.floor((new Date(evt.date) - new Date(lastDate)) / 86400000);
      if (days > 0) {
        score = score * Math.pow(0.98, days);
      }
    }

    score += evt.type === '1on1' ? 10 : 4;
    score = Math.min(100, Math.max(0, score));
    lastSeen = evt.date;
    lastDate = evt.date;
    totalEvents++;
    if (evt.type === '1on1') soloCount++;
    else groupCount++;
  }

  // Decay from last event to today
  const today = todayStr();
  if (lastDate) {
    const days = Math.floor((new Date(today) - new Date(lastDate)) / 86400000);
    if (days > 0) {
      score = score * Math.pow(0.98, days);
    }
  }
  score = Math.min(100, Math.max(0, score));

  db.prepare(`
    UPDATE scores SET
      score = ?, last_seen = ?, total_events = ?,
      solo_count = ?, group_count = ?, last_decay_date = ?
    WHERE friend_id = ?
  `).run(score, lastSeen, totalEvents, soloCount, groupCount, today, friendId);
}
