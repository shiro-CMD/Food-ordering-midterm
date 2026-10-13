require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const MenuItem = require('./model');

const app = express();
app.use(express.json());

const fail = (res, e) =>
  res.status(['CastError', 'ValidationError'].includes(e.name) ? 400 : 500).json({ message: e.message });

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'menu' }));

// CREATE
app.post('/menu', async (req, res) => {
  try { res.status(201).json(await MenuItem.create(req.body)); } catch (e) { fail(res, e); }
});

// READ all (?category=Pizza)
app.get('/menu', async (req, res) => {
  try {
    const filter = req.query.category ? { category: req.query.category } : {};
    res.json(await MenuItem.find(filter).sort({ createdAt: -1 }));
  } catch (e) { fail(res, e); }
});

// READ one
app.get('/menu/:id', async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    item ? res.json(item) : res.status(404).json({ message: 'Menu item not found' });
  } catch (e) { fail(res, e); }
});

// UPDATE
app.put('/menu/:id', async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    item ? res.json(item) : res.status(404).json({ message: 'Menu item not found' });
  } catch (e) { fail(res, e); }
});

// DELETE
app.delete('/menu/:id', async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndDelete(req.params.id);
    item ? res.json({ message: 'Deleted' }) : res.status(404).json({ message: 'Menu item not found' });
  } catch (e) { fail(res, e); }
});

const PORT = process.env.PORT || 8083;
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => app.listen(PORT, () => console.log(`Menu service on ${PORT}`)))
  .catch((e) => { console.error('Mongo connection failed:', e.message); process.exit(1); });
