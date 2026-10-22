import { describe, it, expect } from 'vitest';
import { createSSEParser, applyStreamEvent, type StreamAccumulatorState } from './sseParser';
import type { StreamEvent } from './types';

describe('SSE Parser', () => {
  it('handles split chunks across network buffers', () => {
    const events: StreamEvent[] = [];
    const parser = createSSEParser({
      onEvent: (e) => events.push(e),
    });

    // Chunk 1: partial event
    parser.feed('data: {"type":"delta","text":"Real-');
    expect(events.length).toBe(0);

    // Chunk 2: rest of the event and double newline
    parser.feed('time","seq":1}\n\n');
    expect(events.length).toBe(1);
    expect(events[0]).toEqual({
      type: 'token',
      text: 'Real-time',
      seq: 1,
    });
  });

  it('handles multi-line data fields in a single event block', () => {
    const events: StreamEvent[] = [];
    const parser = createSSEParser({
      onEvent: (e) => events.push(e),
    });

    // Event split across multiple data: lines
    const payload = 'data: {\n' +
      'data: "type": "delta",\n' +
      'data: "text": "streaming",\n' +
      'data: "seq": 2\n' +
      'data: }\n\n';

    parser.feed(payload);

    expect(events.length).toBe(1);
    expect(events[0]).toEqual({
      type: 'token',
      text: 'streaming',
      seq: 2,
    });
  });

  it('ignores comments and keepalive lines', () => {
    const events: StreamEvent[] = [];
    const parser = createSSEParser({
      onEvent: (e) => events.push(e),
    });

    parser.feed(': keepalive ping\n: another comment\n\n');
    expect(events.length).toBe(0);

    parser.feed(': ping\ndata: {"type":"delta","text":"architecture","seq":3}\n\n');
    expect(events.length).toBe(1);
    expect(events[0]).toEqual({
      type: 'token',
      text: 'architecture',
      seq: 3,
    });
  });

  it('enforces monotonic seq and drops duplicate or older seq events', () => {
    const events: StreamEvent[] = [];
    const parser = createSSEParser({
      onEvent: (e) => events.push(e),
    });

    parser.feed('data: {"type":"delta","text":"token1","seq":1}\n\n');
    parser.feed('data: {"type":"delta","text":"token1-dup","seq":1}\n\n'); // duplicate
    parser.feed('data: {"type":"delta","text":"token0-stale","seq":0}\n\n'); // stale
    parser.feed('data: {"type":"delta","text":"token2","seq":2}\n\n');

    expect(events.length).toBe(2);
    expect(events[0]).toEqual({ type: 'token', text: 'token1', seq: 1 });
    expect(events[1]).toEqual({ type: 'token', text: 'token2', seq: 2 });
  });

  it('replaying the same event list twice yields the same final text (idempotent apply)', () => {
    const eventList: StreamEvent[] = [
      { type: 'delta', text: 'Real-time ', seq: 1 },
      { type: 'delta', text: 'streaming ', seq: 2 },
      { type: 'delta', text: 'architecture', seq: 3 },
      { type: 'done', seq: 4 },
    ];

    let state: StreamAccumulatorState = { text: '', lastSeq: -1 };

    // First replay
    for (const ev of eventList) {
      state = applyStreamEvent(state, ev);
    }
    const textFirstRun = state.text;
    expect(textFirstRun).toBe('Real-time streaming architecture');

    // Second replay of the exact same event list
    for (const ev of eventList) {
      state = applyStreamEvent(state, ev);
    }
    const textSecondRun = state.text;
    expect(textSecondRun).toBe(textFirstRun);
  });
});
