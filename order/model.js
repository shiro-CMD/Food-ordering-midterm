const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    items: [
      {
        menuItemId: { type: String, required: true },
        name: String,
        price: Number,
        qty: { type: Number, required: true, min: 1 },
      },
    ],
    total: { type: Number, required: true },
    status: { type: String, enum: ['PLACED', 'PREPARING', 'DELIVERED', 'CANCELLED'], default: 'PLACED' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema, 'orders');
