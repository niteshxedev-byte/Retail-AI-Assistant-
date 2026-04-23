import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import winston from "winston";

// ── Winston Logger ──────────────────────────────────────────────────────
export const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: "logs/error.log", level: "error" }),
        new winston.transports.File({ filename: "logs/combined.log" }),
    ],
});

// Also log to console in development
if (process.env.NODE_ENV !== "production") {
    logger.add(
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            ),
        })
    );
}

// ── Rate Limiter ────────────────────────────────────────────────────────
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,                 // limit each IP to 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
});

// ── Apply all middleware to an Express app ──────────────────────────────
export const applySecurityMiddleware = (app) => {
    // Helmet — secure HTTP headers (XSS, Clickjacking, etc.)
    app.use(helmet());

    // Morgan — HTTP request logging (piped to Winston in production)
    if (process.env.NODE_ENV === "production") {
        app.use(
            morgan("combined", {
                stream: { write: (msg) => logger.info(msg.trim()) },
            })
        );
    } else {
        app.use(morgan("dev"));
    }

    // Rate limiting on API routes
    app.use("/api", apiLimiter);
};
