const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const path = require("path");

// Load environment variables (.env is standard; config.env kept for older setups)
require("dotenv").config({ path: path.join(__dirname, "../.env") });
require("dotenv").config({ path: path.join(__dirname, "../config.env") });

const app = express();

function parseOriginList(raw) {
  return String(raw || "")
    .split(/[\s,]+/)
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

// Extra browser origins (comma- or space-separated), e.g. preview deploy URLs
const additionalCorsOrigins = parseOriginList(process.env.ADDITIONAL_CORS_ORIGINS);
// Multiple staging / Vercel URLs in one env (e.g. new project + branch previews)
const frontendStagingUrls = parseOriginList(process.env.FRONTEND_STAGING_URLS);

// CORS configuration (supports both development and production)
const allowedOrigins = [
  "https://www.kinderbridge.ca",
  "https://kinderbridge.ca", // Also allow without www
  "https://api.kinderbridge.ca", // API subdomain
  "https://day-care-app.onrender.com",
  "https://day-care-app-1.onrender.com", // Current Render URL
  "https://daycare-staging.vercel.app", // Vercel staging SPA (cookie + credentialed CORS)
  process.env.FRONTEND_URL,
  process.env.FRONTEND_STAGING_URL,
  process.env.FRONTEND_DEV_URL || "http://localhost:3000",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  ...frontendStagingUrls,
  ...additionalCorsOrigins,
];
const uniqueAllowedOrigins = [...new Set(allowedOrigins.filter(Boolean))];

const uniqueCspConnectSrc = [
  ...new Set(["'self'", ...uniqueAllowedOrigins].filter(Boolean)),
];

// Enhanced security middleware for production (after CORS origin list so connectSrc stays in sync)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: uniqueCspConnectSrc,
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (
        uniqueAllowedOrigins.includes(origin) ||
        process.env.NODE_ENV !== "production"
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    // Include cache headers so browser preflights don't fail (axios may send them).
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Cache-Control",
      "Pragma",
    ],
  })
);

// Enhanced rate limiting for production
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 250, // limit each IP to 250 requests per windowMs (increased from 100)
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Additional rate limiting for auth endpoints
// Increased limit to handle multiple auth checks (verify + profile) and window focus events
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 requests per windowMs for auth (allows ~15 checkAuth calls)
  message: {
    error: "Too many authentication attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests toward the limit
});

// Cookie parser middleware (must be before body parser)
app.use(cookieParser());

// Stripe webhook must receive raw body for signature verification
try {
  const paymentsRoutes = require("./routes/payments");
  app.post(
    "/api/payments/webhook",
    express.raw({ type: "application/json" }),
    paymentsRoutes.handleWebhook
  );
  console.log("✅ Stripe webhook route loaded successfully");
} catch (error) {
  console.error("❌ Failed to load Stripe webhook route:", error.message);
}

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Production logging
app.use(morgan("combined"));

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
    version: "12.0.0",
    environment: process.env.NODE_ENV || "development",
  });
});

// Database middleware will be added by server.js after MongoDB connection

// Import and use authentication routes with error handling
try {
  const authRoutes = require("./routes/auth");
  app.use("/api/auth", authLimiter, authRoutes);
  console.log("✅ Auth routes loaded successfully");
} catch (error) {
  console.error("❌ Failed to load auth routes:", error.message);
  app.use("/api/auth", (req, res) => {
    res.status(503).json({
      error: "Authentication service temporarily unavailable",
      details: "Route loading failed during server startup",
    });
  });
}

// Import and use other routes with error handling
try {
  const daycareRoutes = require("./routes/daycares");
  const messageRoutes = require("./routes/messages");
  const favoriteRoutes = require("./routes/favorites");
  const applicationRoutes = require("./routes/applications");
  const contactLogRoutes = require("./routes/contactLogs");
  const paymentsRoutes = require("./routes/payments");
  const reportsRoutes = require("./routes/reports");

  app.use("/api/daycares", daycareRoutes);
  app.use("/api/messages", messageRoutes);
  app.use("/api/favorites", favoriteRoutes);
  app.use("/api/applications", applicationRoutes);
  app.use("/api/contact-logs", contactLogRoutes);
  app.use("/api/payments", paymentsRoutes.router);
  app.use("/api/reports", reportsRoutes);
  console.log("✅ Core routes loaded successfully");
} catch (error) {
  console.error("❌ Failed to load core routes:", error.message);
  app.use("/api/daycares", (req, res) => {
    res.status(503).json({
      error: "Daycare service temporarily unavailable",
      details: "Route loading failed during server startup",
    });
  });
  app.use("/api/messages", (req, res) => {
    res.status(503).json({
      error: "Messaging service temporarily unavailable",
      details: "Route loading failed during server startup",
    });
  });
  app.use("/api/favorites", (req, res) => {
    res.status(503).json({
      error: "Favorites service temporarily unavailable",
      details: "Route loading failed during server startup",
    });
  });
  app.use("/api/applications", (req, res) => {
    res.status(503).json({
      error: "Applications service temporarily unavailable",
      details: "Route loading failed during server startup",
    });
  });
  app.use("/api/contact-logs", (req, res) => {
    res.status(503).json({
      error: "Contact logs service temporarily unavailable",
      details: "Route loading failed during server startup",
    });
  });
  app.use("/api/payments", (req, res) => {
    res.status(503).json({
      error: "Payments service temporarily unavailable",
      details: "Route loading failed during server startup",
    });
  });
  app.use("/api/reports", (req, res) => {
    res.status(503).json({
      error: "Reports service temporarily unavailable",
      details: "Route loading failed during server startup",
    });
  });
}

// Global error handler
app.use((error, req, res, next) => {
  console.error("Global error handler:", error);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: "An unexpected error occurred on the server",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    path: req.path,
  });
});

module.exports = app;
