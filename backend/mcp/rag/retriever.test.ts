import { describe, expect, it, vi } from "vitest";
import { BaseRetriever } from "@langchain/core/retrievers";
import { citationFor, createRetriever, KarmaSearchRetriever } from "./retriever.js";
import type { SearchHit } from "./store.js";

function hit(id: string, score = 0.9, extra: Partial<SearchHit> = {}): SearchHit {
    return {
        id,
        docId: id.split(":")[0]!,
        index: Number(id.split(":")[1] ?? 0),
        title: "Doc",
        page: 0,
        text: `text of ${id}`,
        createdAt: "2026-01-01T00:00:00.000Z",
        score,
        ...extra,
    };
}

function setup(vectorHits: SearchHit[], keywordHits: SearchHit[]) {
    const embedQuery = vi.fn(async (_text: string) => [0.1, 0.2]);
    const vectorSearch = vi.fn(async (_v: number[], _k: number, _d?: string[]) => vectorHits);
    const keywordSearch = vi.fn(async (_q: string, _k: number, _d?: string[]) => keywordHits);
    const store = { vectorSearch, keywordSearch };
    return { retriever: createRetriever({ store, embedQuery }), store, embedQuery, vectorSearch, keywordSearch };
}

describe("citationFor", () => {
    it("includes the page when there is one", () => {
        expect(citationFor({ title: "Lease", page: 3 })).toBe("Lease, p.3");
    });
    it("is just the title when there is no page", () => {
        expect(citationFor({ title: "Notes", page: 0 })).toBe("Notes");
    });
});

describe("KarmaSearchRetriever", () => {
    it("is a real LangChain retriever that returns Documents with citation metadata", async () => {
        const { store, embedQuery } = setup([hit("a:0", 0.9, { title: "Lease", page: 2 })], []);
        const r = new KarmaSearchRetriever({ kind: "vector", store, embedQuery, fetchK: 10 });
        expect(r).toBeInstanceOf(BaseRetriever);
        const docs = await r.invoke("notice period");
        expect(docs).toHaveLength(1);
        expect(docs[0]?.pageContent).toBe("text of a:0");
        expect(docs[0]?.metadata.passageId).toBe("a:0");
        expect(docs[0]?.metadata.page).toBe(2);
    });
});

describe("createRetriever (hybrid via EnsembleRetriever)", () => {
    it("returns nothing, and does no work, for a blank query", async () => {
        const { retriever, embedQuery, vectorSearch } = setup([hit("a:0")], []);
        expect(await retriever.search("   ")).toEqual([]);
        expect(embedQuery).not.toHaveBeenCalled();
        expect(vectorSearch).not.toHaveBeenCalled();
    });

    it("embeds the trimmed query and passes the document filter to both searches", async () => {
        const { retriever, embedQuery, vectorSearch, keywordSearch } = setup([], []);
        await retriever.search("  notice period  ", { docIds: ["d1"], topK: 3 });
        expect(embedQuery).toHaveBeenCalledWith("notice period");
        expect(vectorSearch).toHaveBeenCalledWith([0.1, 0.2], 20, ["d1"]);
        expect(keywordSearch).toHaveBeenCalledWith("notice period", 20, ["d1"]);
    });

    it("ranks a passage found by both retrievers first and says so", async () => {
        const { retriever } = setup(
            [hit("a:0", 0.9), hit("b:0", 0.85)],
            [hit("c:0", 4), hit("b:0", 3)]
        );
        const results = await retriever.search("q");
        expect(results[0]?.passageId).toBe("b:0");
        expect(results[0]?.rank).toBe(1);
        expect(results[0]?.matchedBy).toEqual(["vector", "keyword"]);
        expect(results.map((r) => r.rank)).toEqual([1, 2, 3]);
    });

    it("ignores weak vector matches", async () => {
        const { retriever } = setup([hit("weak:0", 0.52), hit("strong:0", 0.8)], []);
        const results = await retriever.search("anything");
        expect(results.map((r) => r.passageId)).toEqual(["strong:0"]);
        expect(results[0]?.vectorScore).toBe(0.8);
    });

    it("still returns keyword matches when every vector match is weak", async () => {
        const { retriever } = setup([hit("weak:0", 0.51)], [hit("kw:0", 3.2)]);
        const results = await retriever.search("rare-term");
        expect(results.map((r) => r.passageId)).toEqual(["kw:0"]);
        expect(results[0]?.matchedBy).toEqual(["keyword"]);
        expect(results[0]?.vectorScore).toBeUndefined();
    });

    it("builds the citation from title and page", async () => {
        const { retriever } = setup([hit("a:0", 0.9, { title: "Lease", page: 3 })], []);
        const [first] = await retriever.search("q");
        expect(first?.citation).toBe("Lease, p.3");
    });

    it("returns at most topK passages", async () => {
        const many = Array.from({ length: 10 }, (_, i) => hit(`d:${i}`, 0.9));
        const { retriever } = setup(many, []);
        expect(await retriever.search("q", { topK: 3 })).toHaveLength(3);
    });
});