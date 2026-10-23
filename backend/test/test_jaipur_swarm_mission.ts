import 'dotenv/config';
import assert from 'node:assert';
import { MultiAgentOrchestrator } from '../src/agent/orchestrator/orchestrator.js';
import type { OrchestratorStreamEvent } from '../src/agent/orchestrator/types.js';

async function testJaipurMission() {
  console.log('\n======================================================');
  console.log(' Testing P0 Jaipur Trip Mission Swarm (3 Concurrent Workers) ');
  console.log('======================================================\n');

  const orchestrator = new MultiAgentOrchestrator({
    maxConcurrency: 3,
    taskTimeoutMs: 30000,
    maxRetries: 1,
  });

  const events: OrchestratorStreamEvent[] = [];
  const runningAtOnce: string[] = [];
  let maxConcurrentRunning = 0;

  const result = await orchestrator.execute('Plan a 3-day Jaipur trip under ₹10,000.', {
    sessionId: `test_jaipur_${Date.now()}`,
    onEvent: (ev) => {
      events.push(ev);
      if (ev.type === 'task_updated') {
        if (ev.status === 'running') {
          if (!runningAtOnce.includes(ev.taskId)) runningAtOnce.push(ev.taskId);
          if (runningAtOnce.length > maxConcurrentRunning) {
            maxConcurrentRunning = runningAtOnce.length;
          }
        } else if (ev.status === 'completed' || ev.status === 'failed' || ev.status === 'cancelled') {
          const idx = runningAtOnce.indexOf(ev.taskId);
          if (idx !== -1) runningAtOnce.splice(idx, 1);
        }
      }
    },
  });

  console.log('• Plan summary:', result.plan.summary);
  console.log('• Total tasks created:', result.tasks.length);
  console.log('• Max concurrent workers observed:', maxConcurrentRunning);
  console.log('• Tasks:');
  for (const t of result.tasks) {
    console.log(`  - [${t.agentType}] (${t.taskId}): ${t.status} (deps: [${t.dependencies.join(', ')}])`);
  }

  assert.strictEqual(result.isMultiAgent, true, 'Should be multi-agent');
  assert.strictEqual(result.tasks.length, 5, 'Should have 5 tasks (3 specialist + 1 analysis + 1 synthesis)');
  assert.ok(maxConcurrentRunning >= 2, 'At least 2-3 workers should run concurrently');
  assert.ok(result.finalOutput.length > 100, 'Chief planner should produce detailed itinerary');

  // Verify findings and citations
  const hasAccommodation = result.finalOutput.toLowerCase().includes('accommodation') || result.finalOutput.toLowerCase().includes('hotel') || result.finalOutput.toLowerCase().includes('hostel');
  const hasTransport = result.finalOutput.toLowerCase().includes('transport') || result.finalOutput.toLowerCase().includes('train') || result.finalOutput.toLowerCase().includes('auto');
  const hasAttractions = result.finalOutput.toLowerCase().includes('hawa mahal') || result.finalOutput.toLowerCase().includes('amber') || result.finalOutput.toLowerCase().includes('fort');
  const hasBudget = result.finalOutput.includes('₹') || result.finalOutput.toLowerCase().includes('budget') || result.finalOutput.toLowerCase().includes('inr');

  console.log('• Content checks:');
  console.log('  - Accommodation included:', hasAccommodation);
  console.log('  - Transport included:', hasTransport);
  console.log('  - Attractions included:', hasAttractions);
  console.log('  - Budget breakdown included:', hasBudget);

  assert.ok(hasAccommodation && hasTransport && hasAttractions && hasBudget, 'All key trip components must be present in synthesized result');

  console.log('\n\x1b[32m✔ Jaipur Trip Mission E2E Swarm Test PASSED!\x1b[0m\n');
}

testJaipurMission().catch((err) => {
  console.error('\x1b[31m✖ Test failed:\x1b[0m', err);
  process.exit(1);
});
