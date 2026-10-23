import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import "dotenv/config";
import { settingsRouter } from "./routes/settings.js";
import { chatRouter } from "./routes/chat.js";
import { workspaceRouter } from "./routes/workspace.routes.js";
import { terminalRouter } from "./routes/terminal.routes.js";
import { vscodeRouter } from "./routes/vscode.routes.js";
import { approvalRouter } from "./routes/approval.routes.js";
import mcpApp from "./mcp/server.js";
import { checkDbHealth } from "./db/index.js";
import path from "node:path";
import fs from "node:fs";
import { AppError } from "./lib/errors.js";
import { logger } from "./lib/logger.js";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.onrender.com') ||
        process.env.NODE_ENV !== 'production'
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);
app.use(express.json());

// Routes
app.use("/api/settings", settingsRouter);
app.use("/api/chat", chatRouter);
app.use("/api/approval", approvalRouter);
app.use("/api/workspace", workspaceRouter);
app.use("/api/terminal", terminalRouter);
app.use("/api/vscode", vscodeRouter);
app.use(mcpApp);


app.get("/health", async (_req, res) => {
  const dbHealth = await checkDbHealth();
  const isHealthy = dbHealth.ok;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "ok" : "degraded",
    service: "karma-backend",
    database: {
      status: dbHealth.ok ? "connected" : "disconnected",
      latencyMs: dbHealth.latencyMs,
      error: dbHealth.error,
    },
    timestamp: new Date().toISOString(),
  });
});

/* -------------------------------------------------------------------------- */
/* Authentication Endpoints (Google & GitHub OAuth)                           */
/* -------------------------------------------------------------------------- */

app.get("/api/auth/config", (_req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    githubClientId: process.env.GITHUB_CLIENT_ID || "",
  });
});

// GitHub OAuth Exchange
app.post("/api/auth/github", async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: "Missing authorization code" });
  }

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = (await tokenRes.json()) as any;
    if (tokenData.error || !tokenData.access_token) {
      return res.status(400).json({
        error: tokenData.error_description || "Failed to exchange GitHub authorization code",
      });
    }

    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent": "Karma-App",
      },
    });
    const userData = (await userRes.json()) as any;

    const name = userData.name || userData.login || "GitHub User";
    const email = userData.email || `${userData.login}@users.noreply.github.com`;
    const avatar = userData.avatar_url;

    res.json({
      success: true,
      user: {
        name,
        email,
        avatar,
        provider: "github",
      },
    });
  } catch (err: any) {
    console.error("GitHub OAuth error:", err);
    res.status(500).json({ error: "Internal server error during GitHub OAuth" });
  }
});

// Google OAuth Verification / Exchange
app.post("/api/auth/google", async (req, res) => {
  const { token, code, redirectUri } = req.body;

  try {
    let accessToken = token;

    if (code) {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID || "",
          client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
          redirect_uri: redirectUri || `${process.env.FRONTEND_URL || "https://karma-1lkx.onrender.com"}/login`,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = (await tokenRes.json()) as any;
      if (tokenData.error) {
        return res.status(400).json({
          error: tokenData.error_description || "Google authorization code exchange failed",
        });
      }
      accessToken = tokenData.access_token;
    }

    if (!accessToken) {
      return res.status(400).json({ error: "No token or authorization code provided" });
    }

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = (await profileRes.json()) as any;

    const name = profile.name || profile.given_name || "Google User";
    const email = profile.email;
    const avatar = profile.picture;

    res.json({
      success: true,
      user: {
        name,
        email,
        avatar,
        provider: "google",
      },
    });
  } catch (err: any) {
    console.error("Google OAuth error:", err);
    res.status(500).json({ error: "Internal server error during Google OAuth" });
  }
});

// Email / Password Mock Handlers
app.post("/api/auth/login", (req, res) => {
  const { email, name } = req.body;
  const displayName = name || (email ? email.split("@")[0] : "User");
  res.json({
    success: true,
    user: {
      name: displayName.charAt(0).toUpperCase() + displayName.slice(1),
      email,
      provider: "password",
    },
  });
});

app.post("/api/auth/signup", (req, res) => {
  const { email, name } = req.body;
  const displayName = name || (email ? email.split("@")[0] : "User");
  res.json({
    success: true,
    user: {
      name: displayName.charAt(0).toUpperCase() + displayName.slice(1),
      email,
      provider: "password",
    },
  });
});
// Static frontend SPA serving (when built)
const frontendDist = path.resolve(process.cwd(), '../frontend/app/dist');
const altFrontendDist = path.resolve(process.cwd(), 'frontend/app/dist');
const distPath = fs.existsSync(frontendDist) ? frontendDist : fs.existsSync(altFrontendDist) ? altFrontendDist : null;

if (distPath) {
  app.use(express.static(distPath));
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/health') || req.path.startsWith('/mcp')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Global Error Handler Middleware
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    logger.warn({ code: err.code, status: err.statusCode, message: err.message }, 'Operational error handled');
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
        details: err.details,
      },
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal Server Error';
  logger.error({ err }, 'Unhandled server exception');
  res.status(500).json({
    error: {
      message: 'An unexpected internal error occurred.',
      code: 'INTERNAL_SERVER_ERROR',
      ...(process.env.NODE_ENV !== 'production' ? { details: message } : {}),
    },
  });
});

const server = app.listen(PORT, () => {
  logger.info(`Karma backend running at http://localhost:${PORT}`);
});

// Graceful Shutdown
const shutdown = () => {
  logger.info('Shutting down Karma backend gracefully...');
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forcefully terminating process after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
