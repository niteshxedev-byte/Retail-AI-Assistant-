import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './src/models/Product.js';
import Order from './src/models/Order.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('MONGODB_URI not found in .env');
    process.exit(1);
}

const importData = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear existing data
        await Product.deleteMany({});
        await Order.deleteMany({});
        console.log('Cleared existing data');

        const productsPath = path.join(__dirname, 'csv_', 'product_inventory.csv');
        const ordersPath = path.join(__dirname, 'csv_', 'orders.csv');

        // Import Products
        const products = [];
        await new Promise((resolve, reject) => {
            fs.createReadStream(productsPath)
                .pipe(csv())
                .on('data', (data) => {
                    try {
                        // Clean and parse stock_per_size
                        const rawStock = data.stock_per_size || '{}';
                        const cleanedStock = rawStock.replace(/'/g, '"');
                        const stockObj = JSON.parse(cleanedStock);

                        products.push({
                            product_id: data.product_id,
                            title: data.title,
                            vendor: data.vendor,
                            price: parseFloat(data.price),
                            compare_at_price: parseFloat(data.compare_at_price),
                            tags: data.tags ? data.tags.split(',').map(t => t.trim()) : [],
                            sizes_available: data.sizes_available ? data.sizes_available.split('|').map(s => s.trim()) : [],
                            stock_per_size: stockObj,
                            is_sale: data.is_sale === 'True',
                            is_clearance: data.is_clearance === 'True',
                            bestseller_score: parseInt(data.bestseller_score || '0')
                        });
                    } catch (err) {
                        console.error(`Error parsing product ${data.product_id}:`, err.message);
                    }
                })
                .on('end', resolve)
                .on('error', reject);
        });
        await Product.insertMany(products);
        console.log(`Imported ${products.length} products`);

        // Import Orders
        const orders = [];
        await new Promise((resolve, reject) => {
            fs.createReadStream(ordersPath)
                .pipe(csv())
                .on('data', (data) => {
                    orders.push({
                        order_id: data.order_id,
                        order_date: new Date(data.order_date),
                        product_id: data.product_id,
                        size: data.size,
                        price_paid: parseFloat(data.price_paid),
                        customer_id: data.customer_id
                    });
                })
                .on('end', resolve)
                .on('error', reject);
        });
        await Order.insertMany(orders);
        console.log(`Imported ${orders.length} orders`);

        process.exit(0);
    } catch (error) {
        console.error('Import failed:', error);
        process.exit(1);
    }
};

importData();
