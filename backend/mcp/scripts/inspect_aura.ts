import { config } from "../config.js";
import { createStore } from "../rag/store.js";

const store = await createStore({ ...config.neo4j, dimensions: config.embedDim });
try {
    const docs = await store.listDocuments();
    console.log(`\nFound ${docs.length} document(s) in Neo4j Aura:`);
    for (const d of docs) {
        console.log(`  - [${d.docId}] "${d.title}" (${d.chunks} chunks, created ${d.createdAt})`);
    }
    if (docs.length === 0) {
        console.log("  (Database currently has no documents stored)");
    }
} finally {
    await store.close();
}

