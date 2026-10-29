import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

const dataDir = path.resolve(process.env.DATA_DIR ?? "./data");
const uploadsDir = path.join(dataDir, "uploads");

export const config = {
    port: Number(process.env.MCP_PORT ?? process.env.PORT ?? 3001),
    dataDir,
    uploadsDir,
    uploadDir: uploadsDir,
    maxFileBytes: 20 * 1024 * 1024,
    maxChars: 2_000_000,
    embedModel: process.env.EMBED_MODEL ?? "Xenova/all-MiniLM-L6-v2",
    embedDim: 384,
    chunkSize: Number(process.env.CHUNK_SIZE ?? 800),
    chunkOverlap: Number(process.env.CHUNK_OVERLAP ?? 120),
    neo4j: {
        uri: process.env.NEO4J_URI ?? "",
        user: process.env.NEO4J_USER ?? process.env.NEO4J_USERNAME ?? "",
        password: process.env.NEO4J_PASSWORD ?? "",
    },
};

export const mcpConfig = {
    // In production the MCP server shares the main API port.
    // MCP_PORT overrides; fallback to PORT (Render injects this), then 3001.
    port: Number(process.env.MCP_PORT) || Number(process.env.PORT) || 3001,
    host: process.env.MCP_HOST || '0.0.0.0',
    endpoint: process.env.MCP_URL || `http://localhost:${Number(process.env.MCP_PORT) || Number(process.env.PORT) || 3001}/mcp`,
    name: 'karma-mcp-server',
    version: '1.0.0',
};
