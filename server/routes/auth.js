import { Router } from 'express';

const router = Router();

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (!password || password !== process.env.PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  req.session.authenticated = true;
  res.json({ ok: true });
});

router.get('/check', (req, res) => {
  res.json({ authenticated: !!req.session.authenticated });
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

export default router;
