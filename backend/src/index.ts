import express from "express";
import cors from "cors";

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

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "karma-backend",
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

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
