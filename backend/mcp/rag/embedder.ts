import path from "node:path";
import { env, pipeline } from "@xenova/transformers";
import { config } from "../config.js";

env.cacheDir = path.join(config.dataDir, "models");

type Extractor = (
    texts: string[],
    options: { pooling: "mean"; normalize: boolean }
) => Promise<{ tolist(): number[][] }>;

const BATCH_SIZE = 16;

let extractorPromise: Promise<Extractor> | undefined;

function getExtractor(): Promise<Extractor> {
    extractorPromise ??= pipeline("feature-extraction", config.embedModel).then(
        (p) => p as unknown as Extractor
    );
    return extractorPromise;
}

export async function embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const extractor = await getExtractor();
    const vectors: number[][] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE);
        const output = await extractor(batch, { pooling: "mean", normalize: true });
        vectors.push(...output.tolist());
    }
    return vectors;
}

export async function embedQuery(text: string): Promise<number[]> {
    const [vector] = await embed([text]);
    if (!vector) throw new Error("Embedding failed: no vector returned");
    return vector;
}