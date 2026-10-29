import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { config } from "../config.js";
import { chunkText } from "./chunker.js";
import type { ChunkInput, Store } from "./store.js";

export type IngestErrorCode =
    | "NO_INPUT"
    | "TITLE_REQUIRED"
    | "EMPTY_CONTENT"
    | "FILE_NOT_FOUND"
    | "PATH_NOT_ALLOWED"
    | "FILE_TOO_LARGE"
    | "UNSUPPORTED_FORMAT"
    | "PDF_HAS_NO_TEXT"
    | "TOO_MUCH_TEXT";

export class IngestError extends Error {
    readonly code: IngestErrorCode;
    readonly hint: string;
    constructor(code: IngestErrorCode, message: string, hint: string) {
        super(message);
        this.name = "IngestError";
        this.code = code;
        this.hint = hint;
    }
}

export type IngestInput = {
    title?: string | undefined;
    content?: string | undefined;
    format?: "text" | "markdown" | undefined;
    filePath?: string | undefined;
};

export type IngestResult = {
    status: "ingested" | "duplicate";
    docId: string;
    title: string;
    pages: number;
    chunks: number | null;
};

export interface IngestDeps {
    store: Pick<Store, "hasDocument" | "addDocument">;
    embed: (texts: string[]) => Promise<number[][]>;
    uploadsDir?: string;
    maxFileBytes?: number;
    maxChars?: number;
    chunkSize?: number;
    chunkOverlap?: number;
}

type Page = { page: number; text: string }; // page 0 = no page information
type Extracted = { suggestedTitle: string | undefined; pages: Page[]; markdown: boolean; isPdf: boolean };

const TEXT_EXTENSIONS = new Set([".txt", ".text"]);
const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown"]);

function tidy(text: string): string {
    return text
        .replace(/\r\n?/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function contentHash(pages: Page[]): string {
    const flat = pages.map((p) => p.text.replace(/\s+/g, " ").trim()).join("\f");
    return createHash("sha256").update(flat).digest("hex").slice(0, 16);
}

export function createIngestor(deps: IngestDeps) {
    const uploadsDir = path.resolve(deps.uploadsDir ?? config.uploadsDir);
    const maxFileBytes = deps.maxFileBytes ?? config.maxFileBytes;
    const maxChars = deps.maxChars ?? config.maxChars;
    const chunkSize = deps.chunkSize ?? config.chunkSize;
    const chunkOverlap = deps.chunkOverlap ?? config.chunkOverlap;

    async function resolveUpload(filePath: string): Promise<string> {
        await fs.mkdir(uploadsDir, { recursive: true });
        const root = await fs.realpath(uploadsDir);
        const candidate = path.resolve(root, filePath);

        let real: string;
        try {
            real = await fs.realpath(candidate);
        } catch {
            const rel = path.relative(root, candidate);
            if (rel.startsWith("..") || path.isAbsolute(rel)) {
                throw new IngestError(
                    "PATH_NOT_ALLOWED",
                    "That path is outside the uploads folder.",
                    `Put the file in ${uploadsDir} and pass just its name.`
                );
            }
            throw new IngestError(
                "FILE_NOT_FOUND",
                `No file named "${filePath}" in the uploads folder.`,
                `Put the file in ${uploadsDir} and try again.`
            );
        }

        const rel = path.relative(root, real);
        if (rel.startsWith("..") || path.isAbsolute(rel)) {
            throw new IngestError(
                "PATH_NOT_ALLOWED",
                "That path is outside the uploads folder.",
                `Put the file in ${uploadsDir} and pass just its name.`
            );
        }
        return real;
    }

    async function readPdf(bytes: Uint8Array): Promise<Page[]> {
        const pdf = await getDocumentProxy(bytes);
        const { text } = await extractText(pdf, { mergePages: false });
        return text.map((t, i) => ({ page: i + 1, text: t }));
    }

    async function extract(input: IngestInput): Promise<Extracted> {
        if (input.filePath) {
            const full = await resolveUpload(input.filePath);
            const ext = path.extname(full).toLowerCase();
            const isPdf = ext === ".pdf";
            const isMarkdown = MARKDOWN_EXTENSIONS.has(ext);
            if (!isPdf && !isMarkdown && !TEXT_EXTENSIONS.has(ext)) {
                throw new IngestError(
                    "UNSUPPORTED_FORMAT",
                    `Files of type "${ext || "(none)"}" are not supported.`,
                    "Use a .pdf, .md or .txt file, or pass the text as `content`."
                );
            }

            const stat = await fs.stat(full);
            if (stat.size > maxFileBytes) {
                throw new IngestError(
                    "FILE_TOO_LARGE",
                    `The file is ${(stat.size / 1024 / 1024).toFixed(1)} MB; the limit is ${(maxFileBytes / 1024 / 1024).toFixed(0)} MB.`,
                    "Split the document into smaller files."
                );
            }

            const bytes = await fs.readFile(full);
            const suggestedTitle = path.basename(full, path.extname(full));
            if (isPdf) {
                const pages = await readPdf(new Uint8Array(bytes));
                return { suggestedTitle, pages, markdown: false, isPdf: true };
            }
            return {
                suggestedTitle,
                pages: [{ page: 0, text: bytes.toString("utf8") }],
                markdown: isMarkdown,
                isPdf: false,
            };
        }

        if (input.content !== undefined) {
            return {
                suggestedTitle: undefined,
                pages: [{ page: 0, text: input.content }],
                markdown: input.format === "markdown",
                isPdf: false,
            };
        }

        throw new IngestError(
            "NO_INPUT",
            "Nothing to ingest.",
            "Provide `content` (text) or `filePath` (a file in the uploads folder)."
        );
    }

    return {
        async ingest(input: IngestInput): Promise<IngestResult> {
            const extracted = await extract(input);
            const pages = extracted.pages
                .map((p) => ({ page: p.page, text: tidy(p.text) }))
                .filter((p) => p.text.length > 0);

            if (pages.length === 0) {
                if (extracted.isPdf) {
                    throw new IngestError(
                        "PDF_HAS_NO_TEXT",
                        "No text could be read from this PDF. It may be a scan.",
                        "Use a PDF with selectable text, or paste the text as `content`."
                    );
                }
                throw new IngestError("EMPTY_CONTENT", "The document is empty.", "Provide some text.");
            }

            const totalChars = pages.reduce((sum, p) => sum + p.text.length, 0);
            if (totalChars > maxChars) {
                throw new IngestError(
                    "TOO_MUCH_TEXT",
                    `The document has ${totalChars.toLocaleString()} characters; the limit is ${maxChars.toLocaleString()}.`,
                    "Split the document into smaller parts."
                );
            }

            const title = (input.title?.trim() || extracted.suggestedTitle || "").trim();
            if (!title) {
                throw new IngestError(
                    "TITLE_REQUIRED",
                    "A title is needed to save this document.",
                    "Ask the user for a short title, then call again with `title`."
                );
            }

            const docId = contentHash(pages);
            const base = { docId, title, pages: pages.length };
            if (await deps.store.hasDocument(docId)) {
                return { status: "duplicate", ...base, chunks: null };
            }

            const pieces: { page: number; text: string }[] = [];
            for (const p of pages) {
                const chunks = await chunkText(p.text, {
                    size: chunkSize,
                    overlap: chunkOverlap,
                    markdown: extracted.markdown,
                });
                for (const c of chunks) pieces.push({ page: p.page, text: c.text });
            }

            const embeddings = await deps.embed(pieces.map((p) => p.text));
            if (embeddings.length !== pieces.length) {
                throw new Error(`Embedder returned ${embeddings.length} vectors for ${pieces.length} chunks`);
            }

            const chunks: ChunkInput[] = pieces.map((p, index) => ({
                index,
                page: p.page,
                text: p.text,
                embedding: embeddings[index]!,
            }));

            const added = await deps.store.addDocument({ docId, title, chunks });
            if (!added) return { status: "duplicate", ...base, chunks: null };

            return { status: "ingested", ...base, chunks: chunks.length };
        },
    };
}

export type Ingestor = ReturnType<typeof createIngestor>;