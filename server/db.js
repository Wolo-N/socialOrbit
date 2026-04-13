import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'social-orbit.db');

// Ensure the directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('1on1', 'group')),
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS event_friends (
    event_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    PRIMARY KEY (event_id, friend_id),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES friends(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS scores (
    friend_id INTEGER UNIQUE NOT NULL,
    score REAL DEFAULT 0,
    last_seen TEXT,
    total_events INTEGER DEFAULT 0,
    solo_count INTEGER DEFAULT 0,
    group_count INTEGER DEFAULT 0,
    last_decay_date TEXT DEFAULT (date('now')),
    FOREIGN KEY (friend_id) REFERENCES friends(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS friend_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS friend_group_members (
    group_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    PRIMARY KEY (group_id, friend_id),
    FOREIGN KEY (group_id) REFERENCES friend_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES friends(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS dismissed_group_suggestions (
    key TEXT PRIMARY KEY
  );

  CREATE TABLE IF NOT EXISTS friend_goals (
    friend_id INTEGER PRIMARY KEY,
    cadence_days INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (friend_id) REFERENCES friends(id) ON DELETE CASCADE
  );
`);

// Seed data on first run
function seed() {
  const count = db.prepare('SELECT COUNT(*) as c FROM friends').get().c;
  if (count > 0) return;

  console.log('Seeded with example data. Delete friends via the UI to start fresh.');

  const insertFriend = db.prepare('INSERT INTO friends (name) VALUES (?)');
  const insertScore = db.prepare(
    'INSERT INTO scores (friend_id, score, last_seen, total_events, solo_count, group_count, last_decay_date) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const insertEvent = db.prepare('INSERT INTO events (date, type, notes) VALUES (?, ?, ?)');
  const insertEventFriend = db.prepare('INSERT INTO event_friends (event_id, friend_id) VALUES (?, ?)');

  const today = new Date();
  const daysAgo = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  };
  const todayStr = daysAgo(0);

  const seedTx = db.transaction(() => {
    // Insert 5 friends
    const friends = ['Alex', 'Jordan', 'Sam', 'Riley', 'Morgan'];
    const friendIds = friends.map((name) => {
      const result = insertFriend.run(name);
      return Number(result.lastInsertRowid);
    });

    // Events spread across last 3 months
    const events = [
      { date: daysAgo(3), type: '1on1', notes: 'Coffee catch-up', friendIds: [friendIds[0]] },
      { date: daysAgo(7), type: 'group', notes: 'Board game night', friendIds: [friendIds[0], friendIds[1], friendIds[2]] },
      { date: daysAgo(14), type: '1on1', notes: 'Lunch downtown', friendIds: [friendIds[1]] },
      { date: daysAgo(21), type: 'group', notes: 'Movie night', friendIds: [friendIds[0], friendIds[3]] },
      { date: daysAgo(35), type: '1on1', notes: 'Long walk in the park', friendIds: [friendIds[2]] },
      { date: daysAgo(50), type: 'group', notes: 'Birthday dinner', friendIds: [friendIds[0], friendIds[1], friendIds[3], friendIds[4]] },
      { date: daysAgo(65), type: '1on1', notes: 'Study session', friendIds: [friendIds[4]] },
      { date: daysAgo(80), type: 'group', notes: 'Hiking trip', friendIds: [friendIds[2], friendIds[3], friendIds[4]] },
    ];

    // Track scores per friend
    const scoreMap = {};
    const lastSeenMap = {};
    const totalMap = {};
    const soloMap = {};
    const groupMap = {};

    friendIds.forEach((id) => {
      scoreMap[id] = 0;
      lastSeenMap[id] = null;
      totalMap[id] = 0;
      soloMap[id] = 0;
      groupMap[id] = 0;
    });

    // Process events oldest first so decay works correctly
    const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date));

    for (const evt of sortedEvents) {
      const result = insertEvent.run(evt.date, evt.type, evt.notes);
      const eventId = Number(result.lastInsertRowid);
      for (const fid of evt.friendIds) {
        insertEventFriend.run(eventId, fid);
        // Apply decay from last seen (or creation) to this event date
        const lastDate = lastSeenMap[fid] || daysAgo(90);
        const daysBetween = Math.floor((new Date(evt.date) - new Date(lastDate)) / 86400000);
        if (daysBetween > 0) {
          scoreMap[fid] = scoreMap[fid] * Math.pow(0.98, daysBetween);
        }
        // Bump
        scoreMap[fid] += evt.type === '1on1' ? 10 : 4;
        scoreMap[fid] = Math.min(100, Math.max(0, scoreMap[fid]));
        lastSeenMap[fid] = evt.date;
        totalMap[fid]++;
        if (evt.type === '1on1') soloMap[fid]++;
        else groupMap[fid]++;
      }
    }

    // Apply decay from last event to today
    for (const fid of friendIds) {
      const lastDate = lastSeenMap[fid] || daysAgo(90);
      const daysBetween = Math.floor((today - new Date(lastDate)) / 86400000);
      if (daysBetween > 0) {
        scoreMap[fid] = scoreMap[fid] * Math.pow(0.98, daysBetween);
      }
      scoreMap[fid] = Math.min(100, Math.max(0, scoreMap[fid]));
      insertScore.run(fid, scoreMap[fid], lastSeenMap[fid], totalMap[fid], soloMap[fid], groupMap[fid], todayStr);
    }
  });

  seedTx();
}

seed();

export default db;
