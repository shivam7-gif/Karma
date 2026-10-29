import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createStore } from "../rag/store.js";
import { config } from "../config.js";

export function registerListDocuments(server: McpServer) {
    server.tool(
        "list_documents",
        "List every document in the user's knowledge base with its id, title and chunk count. Call this first to find valid docIds before searching or deleting.",
        {},
        async () => {
            try {
                let documents: { docId: string; title: string; chunks: number }[] = [];
                if (config.neo4j.uri && config.neo4j.password) {
                    const store = await createStore({ ...config.neo4j, dimensions: config.embedDim });
                    try {
                        const docs = await store.listDocuments();
                        documents = docs.map((d) => ({ docId: d.docId, title: d.title, chunks: d.chunks }));
                    } finally {
                        await store.close();
                    }
                }

                return {
                    content: [
                        {
                            type: "text",
                            text: documents.length
                                ? `Found ${documents.length} document(s):\n` +
                                  documents.map((d) => `- [${d.docId}] "${d.title}" (${d.chunks} chunks)`).join("\n")
                                : "Your knowledge base is empty. Ingest a document first.",
                        },
                    ],
                    structuredContent: { documents },
                };
            } catch (err) {
                return {
                    isError: true,
                    content: [
                        {
                            type: "text",
                            text: `Failed to list documents: ${err instanceof Error ? err.message : String(err)}`,
                        },
                    ],
                };
            }
        }
    );
}
