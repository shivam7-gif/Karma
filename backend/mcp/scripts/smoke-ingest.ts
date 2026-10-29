import { config } from "../config.js";
import { embed, embedQuery } from "../rag/embedder.js";
import { createIngestor } from "../rag/ingest.js";
import { createRetriever } from "../rag/retriever.js";
import { createStore } from "../rag/store.js";

const keep = process.argv.includes("--keep");

const SAMPLE = `Rental Agreement Notes

The tenant must give 60 days written notice before moving out. Notice sent by email is not valid; it must be delivered in writing or by registered post.

The security deposit is refunded within 30 days of the tenant returning the keys, minus any documented damage beyond normal wear and tear.

Pets are allowed with the landlord's written permission. A pet deposit of one month's rent applies to each animal.

Rent is due on the 5th of every month. Payments more than seven days late incur a fee of two percent of the monthly rent.`;

const QUERIES = [
    "how much notice do I need to give before moving out?",
    "security deposit",
    "what is the weather on Mars?",
];

const store = await createStore({ ...config.neo4j, dimensions: config.embedDim });
try {
    const ingestor = createIngestor({ store, embed });
    const retriever = createRetriever({ store, embedQuery });

    console.log("Ingesting (the first run downloads the embedding model)...");
    const started = Date.now();
    const result = await ingestor.ingest({ title: "Smoke test: rental notes", content: SAMPLE });
    console.log(`  ${result.status}, ${result.chunks ?? "-"} chunks, ${Date.now() - started} ms, docId ${result.docId}`);

    for (const query of QUERIES) {
        const passages = await retriever.search(query, { topK: 3, docIds: [result.docId] });
        console.log(`\nQ: ${query}`);
        if (passages.length === 0) console.log("  (nothing relevant found)");
        for (const p of passages) {
            console.log(`  #${p.rank} [${p.matchedBy.join("+")}] ${p.citation}: ${p.text.slice(0, 90).replace(/\n/g, " ")}...`);
        }
    }

    if (!keep) {
        const removed = await store.deleteDocument(result.docId);
        console.log(`\nCleaned up (${removed} chunks removed). Use --keep to leave it in Neo4j.`);
    }
} finally {
    await store.close();
}