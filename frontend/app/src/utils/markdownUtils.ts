/**
 * Utility functions for streaming-safe markdown parsing and typography formatting.
 */

/**
 * Preprocesses markdown during streaming to keep rendering stable and visually clean:
 * 1. If an odd number of code fences (```) exist, auto-close the trailing fence
 *    so it renders as a code block immediately without spilling as raw text.
 * 2. If unclosed bold (**) or inline code (`) markers are dangling at the end,
 *    safely close or normalize them to avoid flashing raw syntax.
 */
export function preprocessStreamingMarkdown(text: string, isStreaming: boolean): string {
  if (!text) return '';

  let processed = text;

  // 1. Check for open code fences (odd count of ```)
  const fenceMatches = processed.match(/```/g);
  const fenceCount = fenceMatches ? fenceMatches.length : 0;
  const hasOpenFence = fenceCount % 2 !== 0;

  if (hasOpenFence) {
    // If the trailing fence line has no newline after language (e.g. "```ts"),
    // ensure there is a newline before closing fence.
    const lastFenceIdx = processed.lastIndexOf('```');
    const afterFence = processed.slice(lastFenceIdx + 3);
    if (!afterFence.includes('\n')) {
      processed += '\n```';
    } else {
      processed += '\n```';
    }
  } else if (isStreaming) {
    // 2. Handle unclosed bold markers outside code blocks
    // Count occurrences of ** that are not escaped
    const boldMatches = processed.match(/(?<!\\)\*\*/g);
    if (boldMatches && boldMatches.length % 2 !== 0) {
      // If ends with partial or open bold, close it safely
      if (processed.endsWith('**')) {
        // Just started bold with no text yet, remove trailing **
        processed = processed.slice(0, -2);
      } else {
        processed += '**';
      }
    }

    // 3. Handle unclosed inline code backtick (`) outside code blocks
    // Count single backticks
    const singleTicks = processed.match(/(?<!`)`(?!`)/g);
    if (singleTicks && singleTicks.length % 2 !== 0) {
      if (processed.endsWith('`')) {
        processed = processed.slice(0, -1);
      } else {
        processed += '`';
      }
    }
  }

  // 4. Curly quotes in prose only (never inside code fences or inline code)
  return formatCurlyQuotesInProse(processed);
}

/**
 * Applies curly quotes to prose text while strictly preserving straight quotes
 * inside code blocks and inline code.
 */
export function formatCurlyQuotesInProse(markdown: string): string {
  // Split on code fences (```...```) and inline code (`...`)
  const parts = markdown.split(/(```[\s\S]*?```|`[^`\n]*?`)/g);

  return parts
    .map((part) => {
      // If this part is a code fence or inline code, keep untouched
      if (part.startsWith('```') || part.startsWith('`')) {
        return part;
      }

      // Format quotes in prose
      let prose = part;
      // Opening double quotes: after whitespace or punctuation/start of string
      prose = prose.replace(/(^|[\s(\[{])"/g, '$1\u201C');
      // Closing double quotes
      prose = prose.replace(/"/g, '\u201D');
      // Opening single quote / apostrophe
      prose = prose.replace(/(^|[\s(\[{])'/g, '$1\u2018');
      // Closing single quote / apostrophe
      prose = prose.replace(/'/g, '\u2019');

      return prose;
    })
    .join('');
}
