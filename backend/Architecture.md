# Backend Architecture

## Overview

This is the backend for the **Retail AI Agent** — an intelligent assistant that helps customers search products, look up orders, evaluate return eligibility, and understand store policies. It is built with **Node.js**, **Express**, **Socket.IO**, **MongoDB**, and **LangChain** (with Google Gemini / Ollama as the LLM provider).

---

## Tech Stack

| Layer          | Technology                          |
| -------------- | ----------------------------------- |
| Runtime        | Node.js (ES Modules)                |
| Framework      | Express 5                           |
| Real-time      | Socket.IO                           |
| Database       | MongoDB Atlas (via Mongoose 9)      |
| AI / LLM       | LangChain + Ollama  |
| Auth           | JWT + bcrypt                        |
| Email          | Nodemailer                          |
| Schema Valid.  | Zod                                 |

---

## Directory Structure

```
backend/
├── server.js              # Entry point — Express + Socket.IO server
├── importData.js          # One-off script to seed DB from CSV files
├── testAgent.js           # Standalone script to test the AI agent
├── .env                   # Environment variables (not committed)
├── package.json
│
├── csv_/                  # Static data files
│   ├── product_inventory.csv
│   ├── orders.csv
│   └── policy.txt
│
└── src/
    ├── config/
    │   └── dbConnection.js       # Mongoose connection helper
    │
    ├── models/
    │   ├── Product.js            # Product schema (inventory, pricing, tags)
    │   ├── Order.js              # Order schema (order history)
    │   ├── User.js               # User schema (auth)
    │   └── Otp.js                # OTP schema (email verification)
    │
    ├── controllers/
    │   └── userController.js     # User-related request handlers
    │
    ├── routes/
    │   ├── index.js              # Route aggregator (/api)
    │   └── auth/                 # Auth-specific routes
    │
    ├── services/
    │   ├── agentService.js       # LangChain agent orchestration & chat processing
    │   └── agentTools.js         # Tool functions: search, order lookup, returns, policy
    │
    ├── middleware/               # (Reserved for auth guards, error handlers, etc.)
    └── utils/                    # (Reserved for helpers)
```

---

## Request Flow

```
Client (React Frontend)
   │
   ▼
Socket.IO connection  ──►  server.js
   │
   │  "user-message" event
   ▼
agentService.js
   │  ── Builds LangChain agent with tool definitions
   │  ── Streams thinking / tool-call / analysis events back via socket
   ▼
agentTools.js
   │  ── searchProducts()    → MongoDB query
   │  ── getProduct()        → MongoDB query
   │  ── getOrder()          → MongoDB query
   │  ── evaluateReturn()    → Business logic + MongoDB
   │  ── getPolicyText()     → Reads csv_/policy.txt
   ▼
"agent-response" event  ──►  Client
```

### Socket Events

| Direction       | Event                 | Description                            |
| --------------- | --------------------- | -------------------------------------- |
| Client → Server | `user-message`        | User sends a chat message              |
| Server → Client | `agent-status`        | `"thinking"` / `"idle"`                |
| Server → Client | `agent-thought`       | LLM internal reasoning step            |
| Server → Client | `agent-tool-call`     | Tool name + arguments being invoked    |
| Server → Client | `agent-tool-result`   | Result returned from tool              |
| Server → Client | `agent-analysis-chunk`| Streamed analysis / partial response   |
| Server → Client | `agent-response`      | Final AI response                      |

---

## Data Models

### Product
- `product_id`, `title`, `vendor`, `price`, `compare_at_price`
- `tags[]`, `sizes_available[]`, `stock_per_size` (Map)
- `is_sale`, `is_clearance`, `bestseller_score`

### Order
- `order_id`, `order_date`, `product_id`, `size`, `price_paid`, `customer_id`

### User
- Standard auth fields (email, hashed password, etc.)

### OTP
- Email verification tokens with expiry

---

## Return Policy Logic (`evaluateReturn`)

1. **Clearance items** → No returns (final sale).
2. **Nocturne brand** → 21-day return window.
3. **Sale items** → 7-day window, store credit only.
4. **Regular items** → 14-day window, full refund.
5. **Aurelia Couture** → Exchange only, no cash refund.
