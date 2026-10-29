import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "../config.js";
import { createStore, escapeLucene, type Store } from "./store.js";

const DIM = config.embedDim;

/** A vector pointing along one axis; different axes are perfectly unrelated. */
function axis(i: number, j?: number, jWeight = 0): number[] {
    const v = new Array<number>(DIM).fill(0);
    v[i] = 1;
    if (j !== undefined) v[j] = jWeight;
    return v;
}

const run = `test-${Date.now()}`;
const docA = `${run}-a`;
const docB = `${run}-b`;

let store: Store;

beforeAll(async () => {
    store = await createStore({ ...config.neo4j, dimensions: DIM });
    await store.addDocument({
        docId: docA,
        title: "Animals A",
        chunks: [
            { index: 0, page: 1, text: "The zebra runs across the plain.", embedding: axis(0) },
            { index: 1, page: 1, text: "Lions hunt at night.", embedding: axis(1) },
            { index: 2, page: 2, text: "Elephants never forget.", embedding: axis(2) },
        ],
    });
    await store.addDocument({
        docId: docB,
        title: "Animals B",
        chunks: [{ index: 0, page: 0, text: "A giraffe eats leaves.", embedding: axis(3) }],
    });
}, 60_000);

afterAll(async () => {
    await store.deleteDocument(docA);
    await store.deleteDocument(docB);
    await store.close();
});

describe("store", () => {
    it("knows which documents exist and refuses duplicates", async () => {
        expect(await store.hasDocument(docA)).toBe(true);
        expect(await store.hasDocument(`${run}-missing`)).toBe(false);
        const again = await store.addDocument({
            docId: docA,
            title: "dup",
            chunks: [{ index: 0, page: 0, text: "x", embedding: axis(9) }],
        });
        expect(again).toBe(false);
    });

    it("lists documents with chunk counts", async () => {
        const docs = await store.listDocuments();
        const a = docs.find((d) => d.docId === docA);
        expect(a?.chunks).toBe(3);
        expect(a?.title).toBe("Animals A");
    });

    it("ranks the nearest chunk first in vector search", async () => {
        const hits = await store.vectorSearch(axis(0, 1, 0.1), 3, [docA, docB]);
        expect(hits[0]?.id).toBe(`${docA}:0`);
        expect(hits[0]?.score).toBeGreaterThan(0.99);
        expect(hits[1]?.id).toBe(`${docA}:1`);
    });

    it("restricts vector search to the requested documents", async () => {
        const hits = await store.vectorSearch(axis(3), 5, [docA]);
        expect(hits.length).toBeGreaterThan(0);
        expect(hits.every((h) => h.docId === docA)).toBe(true);
    });

    it("finds exact words with keyword search", async () => {
        const hits = await store.keywordSearch("zebra", 3, [docA, docB]);
        expect(hits[0]?.id).toBe(`${docA}:0`);
    });

    it("does not choke on punctuation in a keyword query", async () => {
        await expect(store.keywordSearch("what is (zebra)?", 3, [docA])).resolves.toBeDefined();
        await expect(store.keywordSearch("?!()", 3)).resolves.toEqual([]);
    });

    it("returns neighboring chunks in reading order", async () => {
        const window = await store.getWindow(`${docA}:1`, 1);
        expect(window.map((c) => c.index)).toEqual([0, 1, 2]);
        const edge = await store.getWindow(`${docA}:0`, 1);
        expect(edge.map((c) => c.index)).toEqual([0, 1]);
        const single = await store.getWindow(`${docA}:1`, 0);
        expect(single).toHaveLength(1);
    });

    it("returns every chunk of a document in order", async () => {
        const chunks = await store.getDocumentChunks(docA);
        expect(chunks.map((c) => c.index)).toEqual([0, 1, 2]);
    });

    it("deletes a document and reports how many chunks went", async () => {
        const temp = `${run}-temp`;
        await store.addDocument({
            docId: temp,
            title: "Temp",
            chunks: [
                { index: 0, page: 0, text: "one", embedding: axis(10) },
                { index: 1, page: 0, text: "two", embedding: axis(11) },
            ],
        });
        expect(await store.deleteDocument(temp)).toBe(2);
        expect(await store.hasDocument(temp)).toBe(false);
        expect(await store.deleteDocument(temp)).toBe(0);
    });
});

describe("escapeLucene", () => {
    it("escapes special characters", () => {
        expect(escapeLucene("what is (karma)?")).toBe("what is \\(karma\\)\\?");
    });
});