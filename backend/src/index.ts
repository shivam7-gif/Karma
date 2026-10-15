import express from "express";
import cors from "cors";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors({
  origin: 'http://localhost:3000', // Frontend origin
  credentials: true
}));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "ai-eng-backend",
  });
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
