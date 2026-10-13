require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./user');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'login' }));

// POST /login  -> JWT
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string')
      return res.status(400).json({ message: 'email and password are required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.passwordHash)))
      return res.status(401).json({ message: 'Invalid email or password' });

    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, role: user.role, expiresIn: '1h' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /validate  (body.token or Authorization: Bearer)
app.post('/validate', (req, res) => {
  const header = req.headers.authorization || '';
  const token = (req.body && req.body.token) || (header.startsWith('Bearer ') ? header.slice(7) : null);
  if (!token) return res.status(400).json({ message: 'token required' });
  try {
    res.json({ valid: true, payload: jwt.verify(token, process.env.JWT_SECRET) });
  } catch (e) {
    res.status(401).json({ valid: false, message: e.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token' });
  }
});

const PORT = process.env.PORT || 8082;
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => app.listen(PORT, () => console.log(`Login service on ${PORT}`)))
  .catch((e) => { console.error('Mongo connection failed:', e.message); process.exit(1); });
