import { describe, it, expect } from 'vitest';
import { preprocessStreamingMarkdown, formatCurlyQuotesInProse } from './markdownUtils';

describe('Markdown Utilities & Streaming Safety', () => {
  it('auto-closes open code fence during streaming', () => {
    const partial = 'Here is the producer logic:\n```typescript\nconst stream = new EventSource();';
    const processed = preprocessStreamingMarkdown(partial, true);

    // Must close the fence
    expect(processed).toContain('\n```');
    const fences = processed.match(/```/g);
    expect(fences?.length).toBe(2);
  });

  it('keeps closed code fences intact', () => {
    const full = 'Here is the code:\n```typescript\nconst x = 1;\n```\nDone.';
    const processed = preprocessStreamingMarkdown(full, false);

    const fences = processed.match(/```/g);
    expect(fences?.length).toBe(2);
    expect(processed).toContain('const x = 1;');
  });

  it('handles empty code fence gracefully', () => {
    const emptyFence = '```\n```';
    const processed = preprocessStreamingMarkdown(emptyFence, false);
    expect(processed).toBe('```\n```');
  });

  it('handles unclosed bold marker during streaming', () => {
    const partialBold = 'Architecture: **Kafka Event Broker';
    const processed = preprocessStreamingMarkdown(partialBold, true);
    // Unclosed bold is closed to prevent flashing raw ** syntax
    expect(processed.endsWith('**')).toBe(true);

    // If it's just raw trailing ** with no text, it removes it
    const trailingOnly = 'Architecture: **';
    const processedTrailing = preprocessStreamingMarkdown(trailingOnly, true);
    expect(processedTrailing).toBe('Architecture: ');
  });

  it('preserves markdown table syntax', () => {
    const tableMd = '| Component | Role |\n| --- | --- |\n| Kafka | Ingestion |\n| Flink | Processing |';
    const processed = preprocessStreamingMarkdown(tableMd, false);
    expect(processed).toContain('| Component | Role |');
    expect(processed).toContain('| Kafka | Ingestion |');
  });

  it('formats curly quotes in prose while strictly preserving straight quotes in code', () => {
    const input = 'Karma\'s "real-time" engine:\n```json\n{"status": "ok", "type": \'delta\'}\n```\nIt\'s "fast".';
    const output = formatCurlyQuotesInProse(input);

    // In prose: curly quotes applied
    expect(output).toContain('Karma\u2019s');
    expect(output).toContain('\u201Creal-time\u201D');
    expect(output).toContain('It\u2019s');
    expect(output).toContain('\u201Cfast\u201D');

    // In code fence: straight quotes preserved exactly
    expect(output).toContain('{"status": "ok", "type": \'delta\'}');
  });

  it('preserves straight quotes inside inline code badges', () => {
    const input = 'Use `const model = "gpt-4o";` in your code.';
    const output = formatCurlyQuotesInProse(input);
    expect(output).toContain('`const model = "gpt-4o";`');
  });
});
