import type { CallbackManagerForRetrieverRun } from "@langchain/core/callbacks/manager";
import { Document } from "@langchain/core/documents";
import { BaseRetriever, type BaseRetrieverInput } from "@langchain/core/retrievers";
import { EnsembleRetriever } from "@langchain/classic/retrievers/ensemble";
import type { SearchHit, Store } from "./store.js";

export type Retriever = "vector" | "keyword";

export type RetrievedPassage = {
    passageId: string;
    docId: string;
    title: string;
    page: number; // 0 means "no page information"
    chunkIndex: number;
    text: string;
    /** 1 = best match. */
    rank: number;
    /** Cosine-based score (0.5 = unrelated, 1 = identical). Only set when the vector retriever matched. */
    vectorScore?: number | undefined;
    /** Human-readable source, e.g. "Lease Agreement, p.3". */
    citation: string;
    matchedBy: Retriever[];
};

export function citationFor(hit: { title: string; page: number }): string {
    return hit.page > 0 ? `${hit.title}, p.${hit.page}` : hit.title;
}

type PassageMeta = {
    passageId: string;
    docId: string;
    title: string;
    page: number;
    chunkIndex: number;
    score: number;
    retriever: Retriever;
};

function toDocument(hit: SearchHit, retriever: Retriever): Document {
    const metadata: PassageMeta = {
        passageId: hit.id,
        docId: hit.docId,
        title: hit.title,
        page: hit.page,
        chunkIndex: hit.index,
        score: hit.score,
        retriever,
    };
    return new Document({ id: hit.id, pageContent: hit.text, metadata });
}

export interface KarmaSearchConfig {
    kind: Retriever;
    store: Pick<Store, "vectorSearch" | "keywordSearch">;
    embedQuery: (text: string) => Promise<number[]>;
    /** How many candidates to pull before fusion. */
    fetchK: number;
    docIds?: string[] | undefined;
    /** Vector hits below this are dropped (Neo4j cosine score; 0.5 means unrelated). */
    minVectorScore?: number | undefined;
    /** Lets the caller see which passages each retriever returned. */
    onHits?: ((kind: Retriever, ids: string[]) => void) | undefined;
}

/** A LangChain retriever over the Karma graph store: either semantic or keyword. */
export class KarmaSearchRetriever extends BaseRetriever {
    static lc_name() {
        return "KarmaSearchRetriever";
    }
    lc_namespace = ["karma", "retrievers"];
    private readonly config: KarmaSearchConfig;

    constructor(config: KarmaSearchConfig, fields?: BaseRetrieverInput) {
        super(fields);
        this.config = config;
    }

    async _getRelevantDocuments(
        query: string,
        _runManager?: CallbackManagerForRetrieverRun
    ): Promise<Document[]> {
        const { kind, store, embedQuery, fetchK, docIds, minVectorScore = 0.6, onHits } = this.config;

        if (kind === "vector") {
            const vector = await embedQuery(query);
            const hits = await store.vectorSearch(vector, fetchK, docIds);
            const relevant = hits.filter((h) => h.score >= minVectorScore);
            onHits?.("vector", relevant.map((h) => h.id));
            return relevant.map((h) => toDocument(h, "vector"));
        }

        const hits = await store.keywordSearch(query, fetchK, docIds);
        onHits?.("keyword", hits.map((h) => h.id));
        return hits.map((h) => toDocument(h, "keyword"));
    }
}

export interface RetrieverDeps {
    store: Pick<Store, "vectorSearch" | "keywordSearch">;
    embedQuery: (text: string) => Promise<number[]>;
}

export interface SearchOptions {
    topK?: number;
    docIds?: string[] | undefined;
    minVectorScore?: number | undefined;
}

/** Fusion weights for [vector, keyword]. Equal by default. */
const WEIGHTS: [number, number] = [0.5, 0.5];

export function createRetriever(deps: RetrieverDeps) {
    return {
        async search(query: string, options: SearchOptions = {}): Promise<RetrievedPassage[]> {
            const q = query.trim();
            if (!q) return [];
            const { topK = 5, docIds, minVectorScore } = options;

            const found: Record<Retriever, Set<string>> = { vector: new Set(), keyword: new Set() };
            const shared = {
                store: deps.store,
                embedQuery: deps.embedQuery,
                fetchK: Math.max(topK * 4, 20),
                docIds,
                minVectorScore,
                onHits: (kind: Retriever, ids: string[]) => ids.forEach((id) => found[kind].add(id)),
            };

            // LangChain's EnsembleRetriever does the weighted reciprocal rank fusion.
            const hybrid = new EnsembleRetriever({
                retrievers: [
                    new KarmaSearchRetriever({ ...shared, kind: "vector" }),
                    new KarmaSearchRetriever({ ...shared, kind: "keyword" }),
                ],
                weights: WEIGHTS,
            });

            const docs = await hybrid.invoke(q);

            return docs.slice(0, topK).map((doc, i) => {
                const meta = doc.metadata as PassageMeta;
                const matchedBy = (["vector", "keyword"] as const).filter((k) => found[k].has(meta.passageId));
                return {
                    passageId: meta.passageId,
                    docId: meta.docId,
                    title: meta.title,
                    page: meta.page,
                    chunkIndex: meta.chunkIndex,
                    text: doc.pageContent,
                    rank: i + 1,
                    vectorScore: meta.retriever === "vector" ? meta.score : undefined,
                    citation: citationFor(meta),
                    matchedBy,
                };
            });
        },
    };
}