import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Product from '../models/Product.js';
import Order from '../models/Order.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POLICY_PATH = path.join(__dirname, '..', 'csv_', 'policy.txt');

export const getPolicyText = () => {
    try {
        return fs.readFileSync(POLICY_PATH, 'utf-8');
    } catch (error) {
        return "Policy information unavailable.";
    }
};

export const searchProducts = async ({ query, maxPrice, size, tags, isSale }) => {
    const filter = {};
    if (query) {
        filter.$or = [
            { title: { $regex: query, $options: 'i' } },
            { vendor: { $regex: query, $options: 'i' } },
            { tags: { $regex: query, $options: 'i' } }
        ];
    }
    if (maxPrice) filter.price = { $lte: maxPrice };
    if (isSale !== undefined) filter.is_sale = isSale;
    if (tags && tags.length > 0) filter.tags = { $all: tags };
    if (size) filter.sizes_available = size;

    let products = await Product.find(filter).sort({ bestseller_score: -1 }).limit(10);

    if (size) {
        products = products.filter(p => {
            const stock = p.stock_per_size.get(size);
            return stock && stock > 0;
        });
    }

    if (products.length === 0) return "No products found matching the given filters.";
    return JSON.stringify(products.map(p => ({
        product_id: p.product_id,
        title: p.title,
        vendor: p.vendor,
        price: p.price,
        compare_at_price: p.compare_at_price,
        tags: p.tags,
        is_sale: p.is_sale,
        is_clearance: p.is_clearance,
        bestseller_score: p.bestseller_score,
        stock_for_size: size ? (p.stock_per_size.get(size) || 0) : undefined,
    })));
};

export const getProduct = async (productId) => {
    const product = await Product.findOne({ product_id: productId });
    if (!product) return "Product not found.";
    return JSON.stringify(product.toObject());
};

export const getOrder = async (orderId) => {
    const order = await Order.findOne({ order_id: orderId });
    if (!order) return "Order not found.";
    return JSON.stringify(order.toObject());
};

export const evaluateReturn = async (orderId) => {
    const order = await Order.findOne({ order_id: orderId });
    if (!order) return JSON.stringify({ error: "Order not found. Please check the order ID." });

    const product = await Product.findOne({ product_id: order.product_id });
    if (!product) return JSON.stringify({ error: "Product associated with this order no longer exists." });

    const today = new Date();
    const orderDate = new Date(order.order_date);
    const diffDays = Math.ceil((today - orderDate) / (1000 * 60 * 60 * 24));

    const result = {
        order_id: order.order_id,
        order_date: order.order_date,
        product_id: product.product_id,
        product_title: product.title,
        vendor: product.vendor,
        price_paid: order.price_paid,
        size: order.size,
        is_sale: product.is_sale,
        is_clearance: product.is_clearance,
        days_since_order: diffDays,
        canReturn: false,
        reason: "",
        refundType: "None"
    };

    if (product.is_clearance) {
        result.reason = "Clearance items are final sale and not eligible for return.";
        return JSON.stringify(result);
    }

    let returnWindow = product.vendor === 'Nocturne' ? 21 : (product.is_sale ? 7 : 14);

    if (diffDays > returnWindow) {
        result.reason = `Return window of ${returnWindow} days has expired (${diffDays} days since order).`;
        return JSON.stringify(result);
    }

    result.canReturn = true;
    if (product.vendor === 'Aurelia Couture') {
        result.reason = "Aurelia Couture items are eligible for exchange only, no refunds.";
        result.refundType = "Exchange Only";
    } else if (product.is_sale) {
        result.reason = "Sale items are returnable within 7 days for store credit only.";
        result.refundType = "Store Credit";
    } else {
        result.reason = `Eligible for a full refund within the ${returnWindow}-day window.`;
        result.refundType = "Full Refund";
    }

    return JSON.stringify(result);
};
