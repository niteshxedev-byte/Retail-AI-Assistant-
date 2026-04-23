# Project Submission: Retail AI Assistant

## Repository Link
[https://github.com/niteshxe/Retail-AI-Assistant-backend.git](https://github.com/niteshxe/Retail-AI-Assistant-backend.git)

## How to Run Locally

### 1. Clone the repository
```bash
git clone https://github.com/niteshxe/Retail-AI-Assistant-backend.git
cd Retail-AI-Assistant-backend
```

### 2. Backend Setup
```bash
cd backend
npm install
# Copy the example env file and fill in your MongoDB/AI credentials
cp .env.example .env
# Seed the database (optional but recommended)
node importData.js
# Start the backend server
npm run dev
```

### 3. Frontend Setup
```bash
# Open a new terminal
cd frontend
npm install
# Start the frontend development server
npm run dev
```

### 4. Access the Application
- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:5000](http://localhost:5000)

## Features
- **Real-time AI Chat:** Powered by Socket.IO and LangChain.
- **Product Search:** Intelligent filtering and search capabilities.
- **Order Management:** Look up order details and history.
- **Return Policy Evaluation:** Automated return eligibility checks based on brand and item type.
- **Secure Backend:** Includes Helmet, rate limiting, and structured logging.
