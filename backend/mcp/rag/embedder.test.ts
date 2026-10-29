import { describe, expect, it } from "vitest";
import { config } from "../config.js";
import { embed, embedQuery } from "./embedder.js";

const dot = (a: number[], b: number[]) => a.reduce((sum, x, i) => sum + x * b[i]!, 0);

describe("embedder", () => {
  it("returns normalized vectors with the expected dimension", async () => {
    const vectors = await embed(["hello world", "another sentence"]);
    expect(vectors).toHaveLength(2);
    for (const v of vectors) {
      expect(v).toHaveLength(config.embedDim);
      expect(dot(v, v)).toBeCloseTo(1, 3); // length 1 after normalization
    }
  }, 180_000);

  it("places similar meanings closer than unrelated ones", async () => {
    const [cat, kitten, stocks] = await embed([
      "A cat is sitting on the mat.",
      "A kitten rests on a rug.",
      "The stock market crashed on Monday.",
    ]);
    expect(dot(cat!, kitten!)).toBeGreaterThan(dot(cat!, stocks!));
  }, 180_000);

  it("handles more texts than one batch", async () => {
    const texts = Array.from({ length: 20 }, (_, i) => `sentence number ${i}`);
    const vectors = await embed(texts);
    expect(vectors).toHaveLength(20);
  }, 180_000);

  it("embeds a single query", async () => {
    const v = await embedQuery("what is karma?");
    expect(v).toHaveLength(config.embedDim);
  }, 180_000);
});
