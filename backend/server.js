import express from "express";
import http from "http";
import { Server } from "socket.io";
import connectDB from "./src/config/dbConnection.js";
import dotenv from "dotenv";
import apiRoutes from "./src/routes/index.js";
import cors from "cors";
import { applySecurityMiddleware, logger } from "./src/middleware/security.js";
import { processChatMessage, clearHistory } from "./src/services/agentService.js";

dotenv.config();
const PORT = process.env.PORT || 5000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

connectDB(process.env.MONGODB_URI);

const app = express();

// ── Security & Logging Middleware ────────────────────────────────────────
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());
applySecurityMiddleware(app);

app.use("/api", apiRoutes);

app.get("/", (req, res) => {
    res.send("Retail AI Backend Running");
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("user-message", async (data) => {
        const { message } = data;
        console.log(`Received message from ${socket.id}: ${message}`);
        
        // Signal thinking state
        socket.emit("agent-status", "thinking");

        try {
            const response = await processChatMessage(message, socket.id, {
                onThought: (thought) => {
                    socket.emit("agent-thought", thought);
                },
                onToolCall: (toolInfo) => {
                    socket.emit("agent-tool-call", toolInfo);
                },
                onToolResult: (result) => {
                    socket.emit("agent-tool-result", result);
                },
                onAnalysisChunk: (chunk) => {
                    socket.emit("agent-analysis-chunk", chunk);
                },
            });
            
            socket.emit("agent-response", {
                text: response,
                sender: "ai",
                timestamp: new Date()
            });
        } catch (err) {
            console.error("Socket agent error:", err);
            socket.emit("agent-response", {
                text: "Sorry, I encountered an error processing your request. Please try again.",
                sender: "ai",
                timestamp: new Date()
            });
        }
        
        socket.emit("agent-status", "idle");
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
        clearHistory(socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});