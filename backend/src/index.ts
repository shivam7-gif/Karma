import express from "express";
import cors from "cors";
import "dotenv/config";

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

/* -------------------------------------------------------------------------- */
/* Chat Streaming Endpoint (SSE proxy for LLM APIs)                           */
/* -------------------------------------------------------------------------- */

app.post("/api/chat", async (req, res) => {
  const { message, messages: incomingHistory } = req.body;

  // Build full message history
  const history: Array<{ role: string; content: string }> = incomingHistory && Array.isArray(incomingHistory)
    ? incomingHistory.map((m: any) => ({
        role: m.sender === 'user' || m.role === 'user' ? 'user' : 'assistant',
        content: m.text || m.content || '',
      }))
    : message
    ? [{ role: 'user', content: String(message) }]
    : [];

  if (history.length === 0) {
    return res.status(400).json({ error: "Missing message or messages array" });
  }

  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });

  let isAborted = false;
  req.on("close", () => {
    isAborted = true;
  });

  const sendToken = (token: string) => {
    if (isAborted) return;
    res.write(`data: ${JSON.stringify({ type: "token", text: token })}\n\n`);
  };

  const sendDone = () => {
    if (isAborted) return;
    res.write("data: [DONE]\n\n");
    res.end();
  };

  const apiKey = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY;
  const isGroq = !process.env.OPENAI_API_KEY && Boolean(process.env.GROQ_API_KEY);
  const endpoint = isGroq
    ? "https://api.groq.com/openai/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const model = isGroq
    ? process.env.GROQ_MODEL || "llama-3.3-70b-versatile"
    : process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (apiKey) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                "You are Chat A.I, a helpful, brilliant, friendly conversational assistant. Format code in markdown fences, use clean bullet lists, and keep explanations elegant and easy to scan.",
            },
            ...history,
          ],
          stream: true,
          temperature: 0.7,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Upstream API failed: ${response.status} ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!isAborted) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":")) continue;
          if (trimmed.startsWith("data: ")) {
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === "[DONE]") {
              sendDone();
              return;
            }
            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                sendToken(delta);
              }
            } catch (e) {
              // ignore parse errors for partial chunks
            }
          }
        }
      }

      sendDone();
      return;
    } catch (err) {
      console.warn("LLM API proxy streaming failed, falling back to built-in generator:", err);
    }
  }

  // Built-in intelligent streaming response generator (zero-setup fallback)
  const lastUserMsg = history[history.length - 1]?.content.toLowerCase() || "";
  let fullReply = "";

  if (lastUserMsg.includes("hello") || lastUserMsg.includes("hi") || lastUserMsg.includes("hey")) {
    fullReply =
      "Hello! I'm **Chat A.I**, your conversational and voice companion.\n\n" +
      "Here are a few things we can do together:\n" +
      "1. **Explore Voice Mode**: Click the **Voice** button or mic below to open the interactive Aurora Orb with real-time audio visualization.\n" +
      "2. **Ask Questions**: Learn about algorithms, system design, or creative writing.\n" +
      "3. **Write & Debug Code**: Generate fast snippets in TypeScript, Python, or Rust with syntax highlighting.\n\n" +
      "How can I assist your workflow today?";
  } else if (lastUserMsg.includes("voice") || lastUserMsg.includes("aurora") || lastUserMsg.includes("mic")) {
    fullReply =
      "The **Voice Mode** features an interactive WebGL **SoftAurora Orb** that reacts dynamically to sound frequencies:\n\n" +
      "- **Listening State**: Turns luminous sky-blue and breathes with your microphone input.\n" +
      "- **Speaking State**: Blooms into violet-magenta ripples synced to speech synthesis envelopes.\n" +
      "- **Frequency Bands**: Modulates noise amplitude, octave decay, and brightness across sub-bass and speech formant bands.\n\n" +
      "Try clicking the **Voice** button in the floating input pill to see it in action!";
  } else if (lastUserMsg.includes("code") || lastUserMsg.includes("react") || lastUserMsg.includes("function")) {
    fullReply =
      "Here is a clean React hook example for capturing real-time microphone RMS audio levels:\n\n" +
      "```typescript\n" +
      "import { useEffect, useState, useRef } from 'react';\n\n" +
      "export function useMicLevel() {\n" +
      "  const [level, setLevel] = useState(0);\n" +
      "  const audioCtxRef = useRef<AudioContext | null>(null);\n\n" +
      "  useEffect(() => {\n" +
      "    let animationFrame: number;\n" +
      "    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {\n" +
      "      const ctx = new AudioContext();\n" +
      "      const analyser = ctx.createAnalyser();\n" +
      "      const source = ctx.createMediaStreamSource(stream);\n" +
      "      source.connect(analyser);\n" +
      "      const data = new Uint8Array(analyser.frequencyBinCount);\n\n" +
      "      const update = () => {\n" +
      "        analyser.getByteFrequencyData(data);\n" +
      "        const rms = Math.sqrt(data.reduce((a, b) => a + b * b, 0) / data.length);\n" +
      "        setLevel(rms / 128);\n" +
      "        animationFrame = requestAnimationFrame(update);\n" +
      "      };\n" +
      "      update();\n" +
      "    });\n" +
      "    return () => cancelAnimationFrame(animationFrame);\n" +
      "  }, []);\n\n" +
      "  return level;\n" +
      "}\n" +
      "```\n\n" +
      "You can easily feed this `level` straight into shader uniforms or animation curves!";
  } else {
    fullReply =
      `I've analyzed your inquiry regarding **"${history[history.length - 1]?.content}"**.\n\n` +
      "### Key Observations\n" +
      "1. **Adaptive Architecture**: Real-time streaming guarantees instant feedback without blocking the UI.\n" +
      "2. **Multimodal Synchronization**: Text streams in synchrony with speech synthesis and WebGL shader parameters.\n" +
      "3. **Resilient Fallback**: If an upstream connection drops, local recovery seamlessly continues the dialogue.\n\n" +
      "Let me know if you would like me to delve deeper into any specific aspect!";
  }

  // Tokenize by words and punctuation to stream realistic tokens
  const words = fullReply.split(/(\s+)/);
  for (const piece of words) {
    if (isAborted) break;
    sendToken(piece);
    await new Promise((resolve) => setTimeout(resolve, 22));
  }
  sendDone();
});


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
