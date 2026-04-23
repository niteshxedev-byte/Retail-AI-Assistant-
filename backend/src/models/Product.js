import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  product_id: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true
  },
  vendor: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  compare_at_price: {
    type: Number
  },
  tags: [{
    type: String
  }],
  sizes_available: [{
    type: String
  }],
  stock_per_size: {
    type: Map,
    of: Number
  },
  is_sale: {
    type: Boolean,
    default: false
  },
  is_clearance: {
    type: Boolean,
    default: false
  },
  bestseller_score: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);
export default Product;
