import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
    mkdir,
    readdir,
    readFile,
    writeFile,
    lstat,
    realpath,
    rm,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const WORKSPACE_ROOT = path.resolve(
    process.env.KARMA_CODE_WORKSPACE_ROOT ??
    path.join(os.tmpdir(), "karma-code-workspaces")
);

const MAX_FILES = Number(process.env.KARMA_CODE_MAX_FILES) || 3000;
const MAX_FILE_BYTES = Number(process.env.KARMA_CODE_MAX_FILE_BYTES) || 200 * 1024;
const WORKSPACE_TTL_MS = Number(process.env.KARMA_CODE_WORKSPACE_TTL_MS) || 6 * 60 * 60 * 1000;

const IGNORED_DIRS = new Set([
    ".git",
    "node_modules",
    ".next",
    "dist",
    "build",
    "coverage",
    ".venv",
    "vendor",
]);

export type Repository = {
    id: string;
    name: string;
    root: string;
};

export type EditProposal = {
    id: string;
    repoId: string;
    relativePath: string;
    originalContent: string;
    proposedContent: string;
    createdAt: number;
};

export const repositories = new Map<string, Repository>();
export const proposals = new Map<string, EditProposal>();

export async function cleanupStaleWorkspaces(): Promise<void> {
    try {
        await mkdir(WORKSPACE_ROOT, { recursive: true });
        const entries = await readdir(WORKSPACE_ROOT, { withFileTypes: true });
        const now = Date.now();

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const dir = path.join(WORKSPACE_ROOT, entry.name);
            const stat = await lstat(dir);
            if (now - stat.mtimeMs <= WORKSPACE_TTL_MS) continue;
            await rm(dir, { recursive: true, force: true });
            repositories.delete(entry.name);
        }
    } catch {
        // Workspace root may not exist yet.
    }
}

setInterval(() => {
    void cleanupStaleWorkspaces();
}, 30 * 60 * 1000).unref();

function textResult(text: string) {
    return {
        content: [{ type: "text" as const, text }],
    };
}

export function parseGitHubUrl(input: string) {
    let url: URL;

    try {
        url = new URL(input);
    } catch {
        throw new Error("Enter a valid public GitHub repository URL.");
    }

    if (
        url.protocol !== "https:" ||
        url.hostname !== "github.com" ||
        url.port ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
    ) {
        throw new Error(
            "Only HTTPS public repositories hosted on github.com are supported."
        );
    }

    const match = url.pathname.match(
        /^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/
    );

    if (!match) {
        throw new Error(
            "Expected https://github.com/owner/repository"
        );
    }

    return {
        name: `${match[1]}/${match[2]}`,
        url: `https://github.com/${match[1]}/${match[2]}.git`,
    };
}

export function getRepository(repoId: string): Repository {
    const repo = repositories.get(repoId);

    if (!repo) {
        throw new Error(
            "Repository not found in this MCP process. Open it again."
        );
    }

    return repo;
}

export function resolvePath(root: string, relativePath: string): string {
    if (
        !relativePath ||
        path.isAbsolute(relativePath) ||
        relativePath.includes("\0")
    ) {
        throw new Error("Only relative repository paths are allowed.");
    }

    const resolved = path.resolve(root, relativePath);
    const relative = path.relative(root, resolved);

    if (
        relative === ".." ||
        relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative)
    ) {
        throw new Error("Path must remain inside the repository.");
    }

    return resolved;
}

export async function safeFilePath(
    repo: Repository,
    relativePath: string
): Promise<string> {
    const resolved = resolvePath(repo.root, relativePath);
    const absolute = await realpath(resolved);
    const rootReal = await realpath(repo.root);
    const relative = path.relative(rootReal, absolute);

    if (
        relative === ".." ||
        relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative)
    ) {
        throw new Error("File resolves outside the repository.");
    }

    const stat = await lstat(absolute);

    if (!stat.isFile() || stat.isSymbolicLink()) {
        throw new Error("Path is not a regular file.");
    }

    if (stat.size > MAX_FILE_BYTES) {
        throw new Error(
            `File exceeds the ${MAX_FILE_BYTES}-byte limit.`
        );
    }

    return absolute;
}

export async function listRepositoryFiles(root: string, subPath = ""): Promise<string[]> {
    const base = subPath ? await realpath(resolvePath(root, subPath)) : root;
    const files: string[] = [];

    async function walk(directory: string): Promise<void> {
        if (files.length >= MAX_FILES) return;

        const entries = await readdir(directory, {
            withFileTypes: true,
        });

        for (const entry of entries) {
            if (files.length >= MAX_FILES) break;
            if (entry.isSymbolicLink()) continue;
            if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) {
                continue;
            }

            const absolute = path.join(directory, entry.name);

            if (entry.isDirectory()) {
                await walk(absolute);
            } else if (entry.isFile()) {
                files.push(
                    path.relative(root, absolute).split(path.sep).join("/")
                );
            }
        }
    }

    await walk(base);
    return files;
}

export function makeDiff(
    relativePath: string,
    original: string,
    proposed: string
): string {
    const before = original.split(/\r?\n/);
    const after = proposed.split(/\r?\n/);
    const output = [
        `--- a/${relativePath}`,
        `+++ b/${relativePath}`,
    ];

    for (const line of before) output.push(`-${line}`);
    for (const line of after) output.push(`+${line}`);

    return output.join("\n");
}

/* -------------------------------------------------------------------------- */
/* Unified Handler Implementations                                            */
/* -------------------------------------------------------------------------- */

export const codeToolHandlers = {
    async openRepository(repositoryUrl: string): Promise<string> {
        const parsed = parseGitHubUrl(repositoryUrl);
        await cleanupStaleWorkspaces();
        await mkdir(WORKSPACE_ROOT, { recursive: true });

        const repoId = randomUUID();
        const destination = path.join(WORKSPACE_ROOT, repoId);

        await execFileAsync(
            "git",
            ["clone", "--depth=1", "--", parsed.url, destination],
            {
                timeout: 120_000,
                maxBuffer: 4 * 1024 * 1024,
                windowsHide: true,
                env: {
                    ...process.env,
                    GIT_TERMINAL_PROMPT: "0",
                },
            }
        );

        const repo: Repository = {
            id: repoId,
            name: parsed.name,
            root: await realpath(destination),
        };

        repositories.set(repoId, repo);

        let commit = "unknown";
        try {
            const { stdout } = await execFileAsync(
                "git",
                ["-C", repo.root, "rev-parse", "--short", "HEAD"],
                { windowsHide: true }
            );
            commit = stdout.trim();
        } catch {}

        return JSON.stringify(
            {
                repoId,
                repository: repo.name,
                commit,
                message: "Repository cloned successfully.",
                nextTools: [
                    "code_list_files",
                    "code_read_file",
                    "code_search",
                    "code_git_status",
                    "code_git_diff",
                    "code_propose_edit",
                ],
            },
            null,
            2
        );
    },

    async listFiles(repoId: string, subPath = ""): Promise<string> {
        const repo = getRepository(repoId);
        const files = await listRepositoryFiles(repo.root, subPath);
        return files.join("\n") || "No files found.";
    },

    async readFile(repoId: string, filePath: string): Promise<string> {
        const repo = getRepository(repoId);
        const absolute = await safeFilePath(repo, filePath);
        return await readFile(absolute, "utf8");
    },

    async search(repoId: string, query: string, maxResults = 30): Promise<string> {
        const repo = getRepository(repoId);
        const files = await listRepositoryFiles(repo.root);
        const matches: string[] = [];

        for (const filePath of files) {
            if (matches.length >= maxResults) break;

            const absolute = resolvePath(repo.root, filePath);
            const stat = await lstat(absolute);

            if (
                !stat.isFile() ||
                stat.isSymbolicLink() ||
                stat.size > MAX_FILE_BYTES
            ) {
                continue;
            }

            const buffer = await readFile(absolute);
            if (buffer.includes(0)) continue;

            const lines = buffer.toString("utf8").split(/\r?\n/);

            for (let index = 0; index < lines.length; index++) {
                if (lines[index].toLowerCase().includes(query.toLowerCase())) {
                    matches.push(
                        `${filePath}:${index + 1}: ${lines[index].slice(0, 300)}`
                    );

                    if (matches.length >= maxResults) break;
                }
            }
        }

        return matches.length ? matches.join("\n") : "No matches found.";
    },

    async gitStatus(repoId: string): Promise<string> {
        const repo = getRepository(repoId);
        const { stdout } = await execFileAsync(
            "git",
            ["-C", repo.root, "status", "--short", "--branch"],
            { windowsHide: true }
        );
        return stdout || "Working tree is clean.";
    },

    async gitDiff(repoId: string): Promise<string> {
        const repo = getRepository(repoId);
        const { stdout } = await execFileAsync(
            "git",
            ["-C", repo.root, "diff", "--no-ext-diff", "--"],
            { windowsHide: true }
        );
        return stdout || "No tracked-file changes.";
    },

    async proposeEdit(
        repoId: string,
        filePath: string,
        proposedContent: string
    ): Promise<string> {
        const repo = getRepository(repoId);
        const absolute = await safeFilePath(repo, filePath);
        const originalContent = await readFile(absolute, "utf8");

        const proposalId = randomUUID();
        const proposal: EditProposal = {
            id: proposalId,
            repoId,
            relativePath: filePath,
            originalContent,
            proposedContent,
            createdAt: Date.now(),
        };

        proposals.set(proposalId, proposal);

        return JSON.stringify(
            {
                proposalId,
                repoId,
                filePath,
                status: "awaiting_user_approval",
                diff: makeDiff(filePath, originalContent, proposedContent),
                message:
                    "No file has been changed. Show this proposal to the user for approval.",
            },
            null,
            2
        );
    },

    async applyProposal(proposalId: string): Promise<string> {
        const proposal = proposals.get(proposalId);
        if (!proposal) {
            throw new Error("Proposal not found or already consumed.");
        }

        const repo = getRepository(proposal.repoId);
        const absolute = await safeFilePath(repo, proposal.relativePath);
        const currentContent = await readFile(absolute, "utf8");

        if (currentContent !== proposal.originalContent) {
            throw new Error(
                "The file changed after this proposal was created. Re-read it and generate a new proposal."
            );
        }

        await writeFile(absolute, proposal.proposedContent, "utf8");
        proposals.delete(proposalId);

        return JSON.stringify({
            proposalId,
            repoId: proposal.repoId,
            filePath: proposal.relativePath,
            status: "applied",
        });
    },
};

/* -------------------------------------------------------------------------- */
/* McpServer Tool Registrations                                               */
/* -------------------------------------------------------------------------- */

export function registerCodeTools(server: McpServer) {
    server.tool(
        "code_open_repository",
        "Clone a public GitHub repository and return its repository ID.",
        {
            repositoryUrl: z.string().url().describe("Public GitHub repository URL, e.g. https://github.com/owner/repo"),
        },
        async ({ repositoryUrl }) => {
            try {
                return textResult(await codeToolHandlers.openRepository(repositoryUrl));
            } catch (error) {
                return textResult(
                    `Could not open repository: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }
    );

    server.tool(
        "code_list_files",
        "List files in a repository opened with code_open_repository.",
        {
            repoId: z.string().uuid().describe("The repoId returned by code_open_repository"),
            path: z.string().optional().describe("Optional sub-path within repository"),
        },
        async ({ repoId, path: subPath }) => {
            try {
                return textResult(await codeToolHandlers.listFiles(repoId, subPath));
            } catch (error) {
                return textResult(
                    `Could not list files: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }
    );

    server.tool(
        "code_read_file",
        "Read a text file from an opened repository.",
        {
            repoId: z.string().uuid().describe("The repoId returned by code_open_repository"),
            filePath: z.string().min(1).describe("Relative path of file to read"),
        },
        async ({ repoId, filePath }) => {
            try {
                return textResult(await codeToolHandlers.readFile(repoId, filePath));
            } catch (error) {
                return textResult(
                    `Could not read file: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }
    );

    server.tool(
        "code_search",
        "Search for text in source files of an opened repository.",
        {
            repoId: z.string().uuid().describe("The repoId returned by code_open_repository"),
            query: z.string().min(1).max(300).describe("Text or symbol to search for"),
            maxResults: z.number().int().min(1).max(100).optional().describe("Maximum number of results (default 30)"),
        },
        async ({ repoId, query, maxResults }) => {
            try {
                return textResult(await codeToolHandlers.search(repoId, query, maxResults ?? 30));
            } catch (error) {
                return textResult(
                    `Search failed: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }
    );

    server.tool(
        "code_git_status",
        "Get Git status for an opened repository.",
        {
            repoId: z.string().uuid().describe("The repoId returned by code_open_repository"),
        },
        async ({ repoId }) => {
            try {
                return textResult(await codeToolHandlers.gitStatus(repoId));
            } catch (error) {
                return textResult(
                    `Git status failed: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }
    );

    server.tool(
        "code_git_diff",
        "Show the current tracked-file diff for an opened repository.",
        {
            repoId: z.string().uuid().describe("The repoId returned by code_open_repository"),
        },
        async ({ repoId }) => {
            try {
                return textResult(await codeToolHandlers.gitDiff(repoId));
            } catch (error) {
                return textResult(
                    `Git diff failed: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }
    );

    server.tool(
        "code_propose_edit",
        "Create a reviewable edit proposal for an existing repository file without modifying the working file.",
        {
            repoId: z.string().uuid().describe("The repoId returned by code_open_repository"),
            filePath: z.string().describe("Relative path of file to propose edits for"),
            proposedContent: z.string().describe("Complete proposed new content for the file"),
        },
        async ({ repoId, filePath, proposedContent }) => {
            try {
                return textResult(
                    await codeToolHandlers.proposeEdit(repoId, filePath, proposedContent)
                );
            } catch (error) {
                return textResult(
                    `Proposal failed: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }
    );

    server.tool(
        "code_apply_proposal",
        "Apply a previously created edit proposal to write changes to the file in the workspace. Only call this when the user approves or confirms the proposal.",
        {
            proposalId: z.string().uuid().describe("The proposalId returned by code_propose_edit"),
        },
        async ({ proposalId }) => {
            try {
                return textResult(
                    await codeToolHandlers.applyProposal(proposalId)
                );
            } catch (error) {
                return textResult(
                    `Applying proposal failed: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }
    );
}

export async function applyCodeProposal(proposalId: string) {
    return JSON.parse(await codeToolHandlers.applyProposal(proposalId));
}
