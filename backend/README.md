# Retail AI Agent — Backend

A Node.js backend powering an AI-driven retail assistant. It uses **LangChain** with **Google Gemini / Ollama** to answer customer queries about products, orders, returns, and store policies in real time over **Socket.IO**.

---

## Prerequisites

- **Node.js** ≥ 18
- **MongoDB** (Atlas or local instance)
- **npm**

---

## Getting Started

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

See [`.env.example`](.env.example) for the required variables.

### 3. Seed the database

Import product and order data from the CSV files into MongoDB:

```bash
node importData.js
```

### 4. Start the dev server

```bash
npm run dev
```

The server will start on `http://localhost:5000` (or the port specified in `.env`).

---

## Available Scripts

| Command              | Description                                |
| -------------------- | ------------------------------------------ |
| `npm run dev`        | Start the server with **nodemon** (hot reload) |
| `node importData.js` | Seed MongoDB with CSV data                 |
| `node testAgent.js`  | Run a standalone test against the AI agent |

---

## API Endpoints

| Method | Path   | Description              |
| ------ | ------ | ------------------------ |
| GET    | `/`    | Health check             |
| *      | `/api` | API routes (auth, etc.)  |

> Most interaction happens over **Socket.IO** — see [Architecture.md](Architecture.md) for the full event reference.

---

## Project Structure

```
backend/
├── server.js          # Express + Socket.IO entry point
├── importData.js      # DB seeder
├── csv_/              # Static CSV & policy data
└── src/
    ├── config/        # DB connection
    ├── models/        # Mongoose schemas
    ├── controllers/   # Request handlers
    ├── routes/        # Express routers
    ├── services/      # AI agent logic & tools
    ├── middleware/     # (auth guards, etc.)
    └── utils/         # (helpers)
```

For a deeper dive, see [Architecture.md](Architecture.md).

---

## License

ISC
