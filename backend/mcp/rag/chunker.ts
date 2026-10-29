import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export interface ChunkOptions {
    size: number;
    overlap: number;
    markdown: boolean;
}

export interface Chunk {
    index: number;
    text: string;
}

const DEFAULTS: ChunkOptions = { size: 800, overlap: 120, markdown: false };

export async function chunkText(
    text: string,
    options: Partial<ChunkOptions> = {}
): Promise<Chunk[]> {
    const { size, overlap, markdown } = { ...DEFAULTS, ...options };
    if (!text.trim()) return [];

    const params = { chunkSize: size, chunkOverlap: overlap };
    const splitter = markdown
        ? RecursiveCharacterTextSplitter.fromLanguage("markdown", params)
        : new RecursiveCharacterTextSplitter(params);

    const pieces = await splitter.splitText(text);
    return pieces.map((t, index) => ({ index, text: t.trim() })).filter((c) => c.text);
}