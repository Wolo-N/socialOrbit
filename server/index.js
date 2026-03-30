import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';
import { applyDecay } from './decay.js';
import authRoutes from './routes/auth.js';
import friendsRoutes from './routes/friends.js';
import eventsRoutes from './routes/events.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  app.set('trust proxy', 1);
}

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'default-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
    },
  })
);

// Auth middleware for protected routes
function requireAuth(req, res, next) {
  if (req.session.authenticated) return next();
  res.status(401).json({ error: 'Not authenticated' });
}

// Decay middleware — runs once per day on first API call
let lastDecayRun = null;
app.use('/api', (req, res, next) => {
  const today = new Date().toISOString().split('T')[0];
  if (lastDecayRun !== today) {
    applyDecay(db);
    lastDecayRun = today;
  }
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/friends', requireAuth, friendsRoutes);
app.use('/api/events', requireAuth, eventsRoutes);

// Export endpoint
app.get('/api/export', requireAuth, (req, res) => {
  const friends = db.prepare('SELECT * FROM friends').all();
  const events = db.prepare('SELECT * FROM events').all();
  const eventFriends = db.prepare('SELECT * FROM event_friends').all();
  const scores = db.prepare('SELECT * FROM scores').all();
  res.json({ friends, events, eventFriends, scores, exportedAt: new Date().toISOString() });
});

// Production: serve client build
if (isProd) {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Social Orbit server running on port ${PORT}`);
});
