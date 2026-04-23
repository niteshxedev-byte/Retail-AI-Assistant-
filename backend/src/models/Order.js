import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  order_id: {
    type: String,
    required: true,
    unique: true
  },
  order_date: {
    type: Date,
    required: true
  },
  product_id: {
    type: String,
    required: true
  },
  size: {
    type: String,
    required: true
  },
  price_paid: {
    type: Number,
    required: true
  },
  customer_id: {
    type: String,
    required: true
  }
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);
export default Order;
