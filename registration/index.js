require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./user');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'registration' }));

// POST /register
app.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, adminKey } = req.body || {};
    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || !name || !email || !password)
      return res.status(400).json({ message: 'name, email and password are required' });
    if (password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    if (await User.findOne({ email: email.toLowerCase() }))
      return res.status(409).json({ message: 'Email already registered' });

    let finalRole = 'CUSTOMER';
    if (role === 'ADMIN') {
      if (!process.env.ADMIN_KEY || adminKey !== process.env.ADMIN_KEY)
        return res.status(403).json({ message: 'Invalid admin key' });
      finalRole = 'ADMIN';
    }

    const user = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: finalRole,
    });
    res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET /register/check-email?email=a@b.com
app.get('/register/check-email', async (req, res) => {
  try {
    const email = String(req.query.email || '').toLowerCase();
    if (!email) return res.status(400).json({ message: 'email query param required' });
    res.json({ email, available: !(await User.exists({ email })) });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

const PORT = process.env.PORT || 8081;
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => app.listen(PORT, () => console.log(`Registration service on ${PORT}`)))
  .catch((e) => { console.error('Mongo connection failed:', e.message); process.exit(1); });
