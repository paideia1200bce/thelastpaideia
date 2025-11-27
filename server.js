import "dotenv/config";
import express from "express";
import session from "express-session";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Environment variables
const PASSWORD_HASH = process.env.PASSWORD_HASH;
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-in-production";
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const VIDEO_KEY = process.env.VIDEO_KEY || "the-last-paideia.mp4";
const IS_PUBLIC = process.env.IS_PUBLIC === "true";

// Initialize R2 client
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || "",
    secretAccessKey: R2_SECRET_ACCESS_KEY || "",
  },
});

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        mediaSrc: ["'self'", "blob:", "https://*.r2.cloudflarestorage.com", "https://*.cloudflare.com"],
        connectSrc: ["'self'", "https://*.r2.cloudflarestorage.com", "https://*.cloudflare.com"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// Rate limiting for auth endpoint
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute per IP
  message: { error: "Too many attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// General rate limiting
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: "lax",
    },
  })
);

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (IS_PUBLIC || req.session.authenticated) {
    return next();
  }
  res.status(401).json({ error: "Authentication required" });
};

// Check if password protection is enabled
app.get("/api/config", (req, res) => {
  res.json({
    isPublic: IS_PUBLIC,
    isAuthenticated: req.session.authenticated || false,
  });
});

// Password verification endpoint
app.post("/api/auth", authLimiter, async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: "Password is required" });
  }

  if (!PASSWORD_HASH) {
    // If no password hash is set, deny access in production
    if (process.env.NODE_ENV === "production") {
      return res.status(500).json({ error: "Server configuration error" });
    }
    // In development, allow any password
    req.session.authenticated = true;
    return res.json({ success: true });
  }

  try {
    const isValid = await bcrypt.compare(password, PASSWORD_HASH);
    if (isValid) {
      req.session.authenticated = true;
      res.json({ success: true });
    } else {
      res.status(401).json({ error: "Invalid password" });
    }
  } catch (error) {
    console.error("Auth error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
});

// Logout endpoint
app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    res.json({ success: true });
  });
});

// Generate signed URL for video
app.get("/api/video-url", requireAuth, async (req, res) => {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    // Development fallback - serve local file
    return res.json({ url: "/video/local", type: "local" });
  }

  // Get video key from query parameter or use default
  const videoKey = req.query.key || VIDEO_KEY;

  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: videoKey,
    });

    // Generate signed URL valid for 1 hour
    const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
    res.json({ url: signedUrl, type: "r2" });
  } catch (error) {
    console.error("Error generating signed URL:", error);
    res.status(500).json({ error: "Failed to generate video URL" });
  }
});

// Local video fallback for development (serves from public/video if exists)
app.get("/video/local", requireAuth, (req, res) => {
  const videoPath = path.join(__dirname, "public", "video.mp4");
  res.sendFile(videoPath, (err) => {
    if (err) {
      res.status(404).json({ error: "Video not found" });
    }
  });
});

// Serve player page (requires auth)
app.get("/view", (req, res) => {
  if (!IS_PUBLIC && !req.session.authenticated) {
    return res.redirect("/");
  }
  res.sendFile(path.join(__dirname, "public", "player.html"));
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Catch-all: serve index.html for SPA routing
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Public mode: ${IS_PUBLIC}`);
  console.log(`R2 configured: ${!!R2_ACCOUNT_ID}`);
});


