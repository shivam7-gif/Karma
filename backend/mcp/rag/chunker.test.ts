import { describe, expect, it } from "vitest";
import { chunkText } from "./chunker.js";

const sentence = "Karma reads your documents and answers with sources. ";
const longText = Array.from({ length: 60 }, () => sentence).join("");

describe("chunkText", () => {
    it("returns no chunks for empty input", async () => {
        expect(await chunkText("   \n\n  ")).toEqual([]);
    });

    it("keeps short text as one chunk", async () => {
        const chunks = await chunkText("Hello world.");
        expect(chunks).toHaveLength(1);
        expect(chunks[0]!.text).toBe("Hello world.");
    });

    it("respects the size limit and numbers chunks in order", async () => {
        const chunks = await chunkText(longText, { size: 300, overlap: 60 });
        expect(chunks.length).toBeGreaterThan(1);
        chunks.forEach((c, i) => {
            expect(c.index).toBe(i);
            expect(c.text.length).toBeLessThanOrEqual(300);
        });
    });

    it("splits markdown on headings", async () => {
        const md = `# One\n\n${"alpha ".repeat(80)}\n\n# Two\n\n${"beta ".repeat(80)}`;
        const chunks = await chunkText(md, { size: 300, overlap: 30, markdown: true });
        expect(chunks.length).toBeGreaterThan(1);
        expect(chunks.some((c) => c.text.includes("beta"))).toBe(true);
    });
});