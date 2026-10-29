import neo4j, { type Driver } from "neo4j-driver";

export type ChunkInput = {
    index: number;
    page: number; // 0 means "no page information"
    text: string;
    embedding: number[];
};

export type NewDocument = {
    docId: string;
    title: string;
    chunks: ChunkInput[];
};

export type StoredChunk = {
    id: string; // `${docId}:${index}`
    docId: string;
    index: number;
    title: string;
    page: number;
    text: string;
    createdAt: string;
};

export type SearchHit = StoredChunk & { score: number };

export type DocumentSummary = {
    docId: string;
    title: string;
    chunks: number;
    createdAt: string;
};

export interface StoreOptions {
    uri: string;
    user: string;
    password: string;
    dimensions: number;
}

const CHUNK_FIELDS = "{ .id, .docId, .index, .title, .page, .text, .createdAt }";

/** Escape characters that have special meaning in Lucene query syntax. */
export function escapeLucene(query: string): string {
    return query
        .replace(/[+\-!(){}[\]^"~*?:\\/]|&&|\|\|/g, (m) => `\\${m}`)
        .replace(/\s+/g, " ")
        .trim();
}

export async function createStore(options: StoreOptions) {
    if (!Number.isInteger(options.dimensions) || options.dimensions <= 0) {
        throw new Error("dimensions must be a positive integer");
    }

    const driver: Driver = neo4j.driver(
        options.uri,
        neo4j.auth.basic(options.user, options.password),
        { disableLosslessIntegers: true }
    );
    await driver.verifyConnectivity();

    async function run(cypher: string, params: Record<string, unknown> = {}) {
        const session = driver.session();
        try {
            const result = await session.run(cypher, params);
            return result.records;
        } finally {
            await session.close();
        }
    }

    // Constraints and indexes. Safe to run on every startup (IF NOT EXISTS).
    await run(
        "CREATE CONSTRAINT document_id IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE"
    );
    await run(
        "CREATE CONSTRAINT chunk_id IF NOT EXISTS FOR (c:Chunk) REQUIRE c.id IS UNIQUE"
    );
    await run("CREATE INDEX chunk_doc IF NOT EXISTS FOR (c:Chunk) ON (c.docId)");
    await run(`
    CREATE VECTOR INDEX chunk_embedding IF NOT EXISTS
    FOR (c:Chunk) ON c.embedding
    OPTIONS {indexConfig: {
      \`vector.dimensions\`: ${options.dimensions},
      \`vector.similarity_function\`: 'cosine'
    }}`);
    await run(
        "CREATE FULLTEXT INDEX chunk_text IF NOT EXISTS FOR (c:Chunk) ON EACH [c.text]"
    );
    await run("CALL db.awaitIndexes(60)");

    function toHits(records: Awaited<ReturnType<typeof run>>): SearchHit[] {
        return records.map((r) => ({
            ...(r.get("chunk") as StoredChunk),
            score: r.get("score") as number,
        }));
    }

    return {
        /** Does a document with this id exist? */
        async hasDocument(docId: string): Promise<boolean> {
            const records = await run("MATCH (d:Document {id: $docId}) RETURN count(d) AS n", {
                docId,
            });
            return (records[0]?.get("n") as number) > 0;
        },

        /** Store a document, its chunks, and the links between them. False if it already exists. */
        async addDocument(doc: NewDocument): Promise<boolean> {
            if (await this.hasDocument(doc.docId)) return false;
            const createdAt = new Date().toISOString();
            const chunks = doc.chunks.map((c) => ({
                id: `${doc.docId}:${c.index}`,
                index: c.index,
                page: c.page,
                text: c.text,
                embedding: c.embedding,
            }));

            const session = driver.session();
            try {
                await session.executeWrite(async (tx) => {
                    await tx.run(
                        `
            CREATE (d:Document {id: $docId, title: $title, createdAt: $createdAt})
            WITH d
            UNWIND $chunks AS c
            CREATE (ch:Chunk {
              id: c.id, docId: $docId, index: toInteger(c.index), title: $title,
              page: toInteger(c.page), text: c.text, createdAt: $createdAt,
              embedding: c.embedding
            })
            CREATE (d)-[:HAS_CHUNK]->(ch)`,
                        { docId: doc.docId, title: doc.title, createdAt, chunks }
                    );
                    // Link each chunk to the one that follows it.
                    await tx.run(
                        `
            MATCH (a:Chunk {docId: $docId})
            MATCH (b:Chunk {docId: $docId, index: a.index + 1})
            CREATE (a)-[:NEXT]->(b)`,
                        { docId: doc.docId }
                    );
                });
            } finally {
                await session.close();
            }
            return true;
        },

        /** Semantic search: nearest chunks by cosine similarity. */
        async vectorSearch(vector: number[], topK: number, docIds?: string[]): Promise<SearchHit[]> {
            const filter = docIds && docIds.length > 0 ? docIds : null;
            // The index returns its top-k before we filter, so fetch extra when filtering.
            const candidates = filter ? Math.max(topK * 20, 100) : topK;
            const records = await run(
                `
        CALL db.index.vector.queryNodes('chunk_embedding', $k, $vector)
        YIELD node, score
        WHERE $docIds IS NULL OR node.docId IN $docIds
        RETURN node ${CHUNK_FIELDS} AS chunk, score
        ORDER BY score DESC
        LIMIT $topK`,
                { k: neo4j.int(candidates), vector, docIds: filter, topK: neo4j.int(topK) }
            );
            return toHits(records);
        },

        /** Keyword search (Lucene full-text index). */
        async keywordSearch(query: string, topK: number, docIds?: string[]): Promise<SearchHit[]> {
            const q = escapeLucene(query);
            if (!q) return [];
            const filter = docIds && docIds.length > 0 ? docIds : null;
            const candidates = filter ? Math.max(topK * 20, 100) : topK;
            const records = await run(
                `
        CALL db.index.fulltext.queryNodes('chunk_text', $q, {limit: $k})
        YIELD node, score
        WHERE $docIds IS NULL OR node.docId IN $docIds
        RETURN node ${CHUNK_FIELDS} AS chunk, score
        ORDER BY score DESC
        LIMIT $topK`,
                { q, k: neo4j.int(candidates), docIds: filter, topK: neo4j.int(topK) }
            );
            return toHits(records);
        },

        /** A chunk plus up to `window` neighbors on each side, in reading order (follows NEXT links). */
        async getWindow(chunkId: string, window = 1): Promise<StoredChunk[]> {
            const w = Math.min(Math.max(Math.trunc(window), 0), 5);
            const cypher =
                w === 0
                    ? `MATCH (c:Chunk {id: $id}) RETURN c ${CHUNK_FIELDS} AS chunk`
                    : `
            MATCH (c:Chunk {id: $id})
            OPTIONAL MATCH (before:Chunk)-[:NEXT*1..${w}]->(c)
            OPTIONAL MATCH (c)-[:NEXT*1..${w}]->(after:Chunk)
            WITH c, collect(DISTINCT before) + collect(DISTINCT after) + [c] AS nodes
            UNWIND nodes AS n
            WITH DISTINCT n
            ORDER BY n.index
            RETURN n ${CHUNK_FIELDS} AS chunk`;
            const records = await run(cypher, { id: chunkId });
            return records.map((r) => r.get("chunk") as StoredChunk);
        },

        async listDocuments(): Promise<DocumentSummary[]> {
            const records = await run(`
        MATCH (d:Document)
        OPTIONAL MATCH (d)-[:HAS_CHUNK]->(c:Chunk)
        RETURN d.id AS docId, d.title AS title, d.createdAt AS createdAt, count(c) AS chunks
        ORDER BY createdAt DESC`);
            return records.map((r) => ({
                docId: r.get("docId") as string,
                title: r.get("title") as string,
                createdAt: r.get("createdAt") as string,
                chunks: r.get("chunks") as number,
            }));
        },

        /** Every chunk of one document, in order. Used for word clouds and summaries. */
        async getDocumentChunks(docId: string): Promise<StoredChunk[]> {
            const records = await run(
                `MATCH (c:Chunk {docId: $docId}) RETURN c ${CHUNK_FIELDS} AS chunk ORDER BY c.index`,
                { docId }
            );
            return records.map((r) => r.get("chunk") as StoredChunk);
        },

        /** Delete a document and all its chunks. Returns how many chunks were removed. */
        async deleteDocument(docId: string): Promise<number> {
            const records = await run(
                `
        MATCH (d:Document {id: $docId})
        OPTIONAL MATCH (d)-[:HAS_CHUNK]->(c:Chunk)
        WITH d, collect(c) AS chunks
        WITH d, chunks, size(chunks) AS n
        FOREACH (c IN chunks | DETACH DELETE c)
        DETACH DELETE d
        RETURN n`,
                { docId }
            );
            return (records[0]?.get("n") as number | undefined) ?? 0;
        },

        async close(): Promise<void> {
            await driver.close();
        },
    };
}

export type Store = Awaited<ReturnType<typeof createStore>>;