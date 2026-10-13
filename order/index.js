require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const Order = require('./model');

const app = express();
app.use(express.json());

const INSTANCE_ID = process.env.INSTANCE_ID || 'order-1';
const PORT = process.env.PORT || 8085;

// Shows which load-balanced instance answered
app.use((req, res, next) => {
  res.setHeader('X-Served-By', `${INSTANCE_ID}:${PORT}`);
  next();
});

const fail = (res, e) =>
  res.status(['CastError', 'ValidationError'].includes(e.name) ? 400 : 500).json({ message: e.message });

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'order', instance: INSTANCE_ID }));

// POST /orders  (CUSTOMER)  body: { items: [{ menuItemId, qty }] }
app.post('/orders', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ message: 'items array required' });

    const lines = [];
    let total = 0;
    for (const it of items) {
      const qty = Number(it.qty);
      if (!it.menuItemId || !Number.isInteger(qty) || qty < 1)
        return res.status(400).json({ message: 'Each item needs menuItemId and integer qty >= 1' });

      const r = await fetch(`${process.env.MENU_URL}/menu/${it.menuItemId}`);
      if (!r.ok) return res.status(400).json({ message: `Menu item ${it.menuItemId} not found` });
      const m = await r.json();
      if (!m.available) return res.status(400).json({ message: `${m.name} is not available` });

      lines.push({ menuItemId: it.menuItemId, name: m.name, price: m.price, qty });
      total += m.price * qty;
    }
    res.status(201).json(await Order.create({ userId, items: lines, total }));
  } catch (e) { fail(res, e); }
});

// GET /orders/my  (CUSTOMER)
app.get('/orders/my', async (req, res) => {
  try { res.json(await Order.find({ userId: req.headers['x-user-id'] }).sort({ createdAt: -1 })); }
  catch (e) { fail(res, e); }
});

// GET /orders  (ADMIN)
app.get('/orders', async (req, res) => {
  try { res.json(await Order.find().sort({ createdAt: -1 })); } catch (e) { fail(res, e); }
});

// PUT /orders/:id/status  (ADMIN)  body: { status }
app.put('/orders/:id/status', async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id, { status: req.body.status }, { new: true, runValidators: true }
    );
    order ? res.json(order) : res.status(404).json({ message: 'Order not found' });
  } catch (e) { fail(res, e); }
});

// DELETE /orders/:id  (ADMIN)
app.delete('/orders/:id', async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    order ? res.json({ message: 'Deleted' }) : res.status(404).json({ message: 'Order not found' });
  } catch (e) { fail(res, e); }
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => app.listen(PORT, () => console.log(`Order service ${INSTANCE_ID} on ${PORT}`)))
  .catch((e) => { console.error('Mongo connection failed:', e.message); process.exit(1); });
