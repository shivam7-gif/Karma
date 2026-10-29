import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createIngestor, IngestError, type IngestErrorCode } from "./ingest.js";
import type { NewDocument } from "./store.js";

/** Build a tiny valid PDF with one line of text per page. */
function makePdf(pages: string[]): Buffer {
    const objs: string[] = [];
    objs.push("<< /Type /Catalog /Pages 2 0 R >>");
    const kids = pages.map((_, i) => `${4 + i * 2} 0 R`).join(" ");
    objs.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
    objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    pages.forEach((text, i) => {
        const stream = `BT /F1 12 Tf 72 720 Td (${text.replace(/[()\\]/g, "\\$&")}) Tj ET`;
        objs.push(
            `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${5 + i * 2} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`
        );
        objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    });
    let out = "%PDF-1.4\n";
    const offsets: number[] = [];
    objs.forEach((o, i) => {
        offsets.push(out.length);
        out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
    out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(out, "latin1");
}

let root: string;
let uploads: string;

beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "karma-ingest-"));
    uploads = path.join(root, "uploads");
    await fs.mkdir(uploads);
    await fs.writeFile(path.join(root, "secret.txt"), "top secret");
    await fs.writeFile(path.join(uploads, "notes.txt"), "Plain notes about the garden.");
    await fs.writeFile(path.join(uploads, "guide.md"), "# Guide\n\nFirst section text.\n\n# Second\n\nMore text here.");
    await fs.writeFile(path.join(uploads, "malware.exe"), "nope");
    await fs.writeFile(path.join(uploads, "big.txt"), "x".repeat(200));
    await fs.writeFile(path.join(uploads, "lease.pdf"), makePdf(["Hello from page one", "Second page talks about notice periods"]));
    await fs.writeFile(path.join(uploads, "blank.pdf"), makePdf([""]));
});

afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true });
});

function setup(overrides: Partial<Parameters<typeof createIngestor>[0]> = {}) {
    const stored = new Map<string, NewDocument>();
    const store = {
        hasDocument: vi.fn(async (id: string) => stored.has(id)),
        addDocument: vi.fn(async (doc: NewDocument) => {
            if (stored.has(doc.docId)) return false;
            stored.set(doc.docId, doc);
            return true;
        }),
    };
    const embed = vi.fn(async (texts: string[]) => texts.map((_, i) => [i, 0, 1]));
    const ingestor = createIngestor({ store, embed, uploadsDir: uploads, ...overrides });
    return { ingestor, store, embed, stored };
}

async function codeOf(promise: Promise<unknown>): Promise<IngestErrorCode | "no error"> {
    try {
        await promise;
        return "no error";
    } catch (e) {
        if (e instanceof IngestError) return e.code;
        throw e;
    }
}

describe("ingest text content", () => {
    it("chunks, embeds and stores a document", async () => {
        const { ingestor, stored, embed } = setup();
        const result = await ingestor.ingest({ title: "Garden", content: "Tomatoes need sun. Basil needs water." });
        expect(result.status).toBe("ingested");
        expect(result.chunks).toBe(1);
        expect(result.title).toBe("Garden");
        expect(embed).toHaveBeenCalledTimes(1);

        const doc = stored.get(result.docId)!;
        expect(doc.chunks[0]).toMatchObject({ index: 0, page: 0, text: "Tomatoes need sun. Basil needs water." });
        expect(doc.chunks[0]!.embedding).toEqual([0, 0, 1]);
    });

    it("numbers chunks in order across a long document", async () => {
        const { ingestor, stored } = setup({ chunkSize: 100, chunkOverlap: 10 });
        const content = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
        const result = await ingestor.ingest({ title: "Long", content });
        expect(result.chunks).toBeGreaterThan(3);
        const doc = stored.get(result.docId)!;
        expect(doc.chunks.map((c) => c.index)).toEqual(doc.chunks.map((_, i) => i));
    });

    it("treats the same content as a duplicate without re-embedding", async () => {
        const { ingestor, embed } = setup();
        const first = await ingestor.ingest({ title: "A", content: "Same words here." });
        const second = await ingestor.ingest({ title: "B", content: "Same words here." });
        expect(second.status).toBe("duplicate");
        expect(second.docId).toBe(first.docId);
        expect(second.chunks).toBeNull();
        expect(embed).toHaveBeenCalledTimes(1);
    });

    it("ignores whitespace differences when detecting duplicates", async () => {
        const { ingestor } = setup();
        const first = await ingestor.ingest({ title: "A", content: "Same   words\n\nhere." });
        const second = await ingestor.ingest({ title: "A", content: "Same words here." });
        expect(second.docId).toBe(first.docId);
    });

    it("reports a duplicate if another request stored it first", async () => {
        const { ingestor, store } = setup();
        store.addDocument.mockResolvedValueOnce(false);
        const result = await ingestor.ingest({ title: "Race", content: "Some text." });
        expect(result.status).toBe("duplicate");
    });
});

describe("ingest errors", () => {
    it("needs some input", async () => {
        expect(await codeOf(setup().ingestor.ingest({ title: "x" }))).toBe("NO_INPUT");
    });
    it("needs a title for pasted content", async () => {
        expect(await codeOf(setup().ingestor.ingest({ content: "text" }))).toBe("TITLE_REQUIRED");
        expect(await codeOf(setup().ingestor.ingest({ title: "   ", content: "text" }))).toBe("TITLE_REQUIRED");
    });
    it("rejects empty content", async () => {
        expect(await codeOf(setup().ingestor.ingest({ title: "x", content: " \n\n " }))).toBe("EMPTY_CONTENT");
    });
    it("rejects too much text", async () => {
        const { ingestor } = setup({ maxChars: 50 });
        expect(await codeOf(ingestor.ingest({ title: "x", content: "y".repeat(100) }))).toBe("TOO_MUCH_TEXT");
    });
    it("carries a hint the caller can act on", async () => {
        try {
            await setup().ingestor.ingest({ content: "text" });
            expect.unreachable();
        } catch (e) {
            expect((e as IngestError).hint).toMatch(/title/i);
        }
    });
});

describe("ingest files", () => {
    it("takes the title from the file name", async () => {
        const { ingestor } = setup();
        const result = await ingestor.ingest({ filePath: "notes.txt" });
        expect(result.title).toBe("notes");
        expect(result.status).toBe("ingested");
    });

    it("lets an explicit title win over the file name", async () => {
        const { ingestor } = setup();
        expect((await ingestor.ingest({ filePath: "notes.txt", title: "Garden Notes" })).title).toBe("Garden Notes");
    });

    it("reads markdown files", async () => {
        const { ingestor, stored } = setup({ chunkSize: 40, chunkOverlap: 5 });
        const result = await ingestor.ingest({ filePath: "guide.md" });
        expect(result.chunks).toBeGreaterThan(1);
        expect(stored.get(result.docId)!.chunks.some((c) => c.text.includes("More text"))).toBe(true);
    });

    it("records page numbers for PDFs", async () => {
        const { ingestor, stored } = setup();
        const result = await ingestor.ingest({ filePath: "lease.pdf", title: "Lease" });
        expect(result.pages).toBe(2);
        const chunks = stored.get(result.docId)!.chunks;
        const page1 = chunks.find((c) => c.text.includes("page one"));
        const page2 = chunks.find((c) => c.text.includes("notice periods"));
        expect(page1?.page).toBe(1);
        expect(page2?.page).toBe(2);
        expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
    });

    it("explains when a PDF has no readable text", async () => {
        expect(await codeOf(setup().ingestor.ingest({ filePath: "blank.pdf" }))).toBe("PDF_HAS_NO_TEXT");
    });

    it("rejects unsupported file types", async () => {
        expect(await codeOf(setup().ingestor.ingest({ filePath: "malware.exe" }))).toBe("UNSUPPORTED_FORMAT");
    });

    it("rejects files over the size limit", async () => {
        const { ingestor } = setup({ maxFileBytes: 100 });
        expect(await codeOf(ingestor.ingest({ filePath: "big.txt" }))).toBe("FILE_TOO_LARGE");
    });

    it("reports a missing file", async () => {
        expect(await codeOf(setup().ingestor.ingest({ filePath: "nope.txt" }))).toBe("FILE_NOT_FOUND");
    });
});

describe("path safety", () => {
    it("refuses to climb out of the uploads folder", async () => {
        const { ingestor } = setup();
        expect(await codeOf(ingestor.ingest({ filePath: "../secret.txt" }))).toBe("PATH_NOT_ALLOWED");
    });

    it("refuses an absolute path outside the uploads folder", async () => {
        const { ingestor } = setup();
        expect(await codeOf(ingestor.ingest({ filePath: path.join(root, "secret.txt") }))).toBe("PATH_NOT_ALLOWED");
    });

    it("refuses a non-existent path outside the uploads folder", async () => {
        const { ingestor } = setup();
        expect(await codeOf(ingestor.ingest({ filePath: "../../does-not-exist.txt" }))).toBe("PATH_NOT_ALLOWED");
    });

    it("accepts an absolute path inside the uploads folder", async () => {
        const { ingestor } = setup();
        const result = await ingestor.ingest({ filePath: path.join(uploads, "notes.txt") });
        expect(result.status).toBe("ingested");
    });
});