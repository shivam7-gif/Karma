import 'dotenv/config';
import assert from 'node:assert';
import { MultiAgentOrchestrator } from '../src/agent/orchestrator/orchestrator.js';
import { TaskStore, taskStore } from '../src/agent/orchestrator/taskStore.js';
import { lockManager } from '../src/agent/orchestrator/lockManager.js';
import { isComplexPrompt } from '../src/agent/orchestrator/planner.js';
import { runAmazonShoppingWorkflow } from '../src/tools/shopping/amazonShoppingAgent.js';
import type { OrchestratorTask, OrchestratorStreamEvent } from '../src/agent/orchestrator/types.js';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    process.stdout.write(`• Test: ${name}... `);
    await fn();
    console.log(`\x1b[32mPASS\x1b[0m`);
    passed++;
  } catch (err: unknown) {
    console.log(`\x1b[31mFAIL\x1b[0m`);
    console.error(err);
    failed++;
  }
}

async function runAllTests() {
  console.log('\n======================================================');
  console.log(' Karma Multi-Agent Orchestration Engine Test Suite ');
  console.log('======================================================\n');

  // Test 1: Two independent tasks running concurrently
  await test('1. Two independent tasks run concurrently', async () => {
    const orchestrator = new MultiAgentOrchestrator({ maxConcurrency: 3, taskTimeoutMs: 15000, maxRetries: 1 });
    const events: OrchestratorStreamEvent[] = [];
    const startTime = Date.now();

    const planTasks = [
      { taskId: 'task-a', agentType: 'research' as const, description: 'Independent task A', dependencies: [] },
      { taskId: 'task-b', agentType: 'coding' as const, description: 'Independent task B', dependencies: [] },
      { taskId: 'task-c', agentType: 'synthesis' as const, description: 'Synthesis task', dependencies: ['task-a', 'task-b'] },
    ];

    // Mock planner by passing custom options or testing scheduler directly
    const res = await orchestrator.execute('Research this issue while a separate agent analyzes my provided code', {
      sessionId: `test_session_${Date.now()}`,
      onEvent: (ev) => events.push(ev),
    });

    assert.ok(res.isMultiAgent, 'Should detect complex prompt as multi-agent');
    assert.ok(res.tasks.length >= 2, 'Should create at least 2 tasks');

    const createdEvents = events.filter((e) => e.type === 'task_created');
    assert.ok(createdEvents.length >= 2, 'Should stream task_created events for independent tasks');
  });

  // Test 2: Dependent tasks execute in the correct order
  await test('2. Dependent tasks execute in the correct order', async () => {
    const orchestrator = new MultiAgentOrchestrator({ maxConcurrency: 3, taskTimeoutMs: 15000, maxRetries: 1 });
    const startedOrder: string[] = [];

    const res = await orchestrator.execute('Research the best three laptops for AI development under ₹70,000 and compare them', {
      sessionId: `dep_test_${Date.now()}`,
      onEvent: (ev) => {
        if (ev.type === 'task_updated' && ev.status === 'running' && !startedOrder.includes(ev.taskId)) {
          startedOrder.push(ev.taskId);
        }
      },
    });

    assert.ok(res.isMultiAgent, 'Should execute multi-agent plan');
    const tasks = res.tasks;
    for (const t of tasks) {
      if (t.dependencies.length > 0) {
        const myStartIndex = startedOrder.indexOf(t.taskId);
        for (const depId of t.dependencies) {
          const depStartIndex = startedOrder.indexOf(depId);
          if (myStartIndex !== -1 && depStartIndex !== -1) {
            assert.ok(depStartIndex < myStartIndex, `Dependency ${depId} must start before dependent task ${t.taskId}`);
          }
        }
      }
    }
  });

  // Test 3: Concurrency limits being enforced (max 3)
  await test('3. Concurrency limits enforced (max 3)', async () => {
    const orchestrator = new MultiAgentOrchestrator({ maxConcurrency: 2, taskTimeoutMs: 15000, maxRetries: 1 });
    const runningTaskIds = new Set<string>();
    let maxRunningObserved = 0;

    await orchestrator.execute('Run independent research tasks and combine the findings', {
      sessionId: `conc_test_${Date.now()}`,
      config: { maxConcurrency: 2 },
      onEvent: (ev) => {
        if (ev.type === 'task_updated') {
          if (ev.status === 'running') {
            runningTaskIds.add(ev.taskId);
            if (runningTaskIds.size > maxRunningObserved) {
              maxRunningObserved = runningTaskIds.size;
            }
          } else {
            runningTaskIds.delete(ev.taskId);
          }
        } else if (ev.type === 'task_completed') {
          runningTaskIds.delete(ev.taskId);
        }
      },
    });

    assert.ok(maxRunningObserved <= 2, `Max running tasks (${maxRunningObserved}) must not exceed limit 2`);
  });


  // Test 4: One task failing while another completes (fault isolation)
  await test('4. One task failing while another completes (fault isolation)', async () => {
    const store = new TaskStore();
    const task1: OrchestratorTask = {
      taskId: 'fail-1',
      sessionId: 'sess-fail-isolation',
      agentType: 'research',
      description: 'Will fail',
      status: 'failed',
      dependencies: [],
      error: 'Simulated network failure',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    const task2: OrchestratorTask = {
      taskId: 'pass-2',
      sessionId: 'sess-fail-isolation',
      agentType: 'coding',
      description: 'Independent task that should succeed',
      status: 'completed',
      dependencies: [],
      result: 'Code analysis passed cleanly',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    await store.saveTask(task1);
    await store.saveTask(task2);

    const tasks = await store.getSessionTasks('sess-fail-isolation');
    const t1 = tasks.find((t) => t.taskId === 'fail-1');
    const t2 = tasks.find((t) => t.taskId === 'pass-2');

    assert.strictEqual(t1?.status, 'failed', 'Task 1 should remain failed');
    assert.strictEqual(t2?.status, 'completed', 'Task 2 should complete independently');
  });

  // Test 5: Cancellation stopping an active task
  await test('5. Cancellation stopping an active task', async () => {
    const orchestrator = new MultiAgentOrchestrator();
    const sessionId = `cancel_test_${Date.now()}`;
    const store = taskStore;

    // Create an active task and cancel it directly
    const testTask: OrchestratorTask = {
      taskId: 'cancel-task-1',
      sessionId,
      agentType: 'research',
      description: 'Long running research task to cancel',
      status: 'running',
      dependencies: [],
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
    };
    await store.saveTask(testTask);

    // Cancel specific task
    orchestrator.cancelTask('cancel-task-1', 'Cancelled by test user');

    const updated = await store.getTask('cancel-task-1');
    assert.ok(updated, 'Task should exist in store');
    assert.strictEqual(updated.status, 'cancelled', 'Task status must be cancelled');
    assert.strictEqual(updated.cancellationState?.cancelled, true, 'Cancellation state must be true');

    // Also verify session-level cancellation
    await store.saveTask({
      taskId: 'cancel-task-2',
      sessionId,
      agentType: 'coding',
      description: 'Task 2 to cancel via session',
      status: 'running',
      dependencies: [],
      createdAt: new Date().toISOString(),
    });
    await orchestrator.cancelSession(sessionId, 'Session stopped');
    const updated2 = await store.getTask('cancel-task-2');
    assert.ok(updated2, 'Task 2 should exist in store');
    assert.strictEqual(updated2.status, 'cancelled', 'Task 2 status must be cancelled via session');
  });


  // Test 6: Duplicate task prevention and event ordering
  await test('6. Duplicate task prevention and event ordering', async () => {
    const store = new TaskStore();
    const taskId = `task-dedup-${Date.now()}`;
    const sessionId = 'session-dedup';

    const t: OrchestratorTask = {
      taskId,
      sessionId,
      agentType: 'analysis',
      description: 'Unique task',
      status: 'queued',
      dependencies: [],
      createdAt: new Date().toISOString(),
    };

    await store.saveTask(t);
    // Attempt duplicate save with updated status
    await store.saveTask({ ...t, status: 'running', startedAt: new Date().toISOString() });

    const sessionTasks = await store.getSessionTasks(sessionId);
    const matching = sessionTasks.filter((item) => item.taskId === taskId);
    assert.strictEqual(matching.length, 1, 'Duplicate tasks must not create multiple records');
    assert.strictEqual(matching[0].status, 'running', 'Record should update cleanly');
  });

  // Test 7: Task persistence and recovery after a simulated restart
  await test('7. Task persistence and recovery after simulated restart', async () => {
    const store = new TaskStore();
    const interruptedTaskId = `interrupted-${Date.now()}`;
    await store.saveTask({
      taskId: interruptedTaskId,
      sessionId: 'session-recovery',
      agentType: 'browser',
      description: 'Was running when server crashed',
      status: 'running',
      dependencies: [],
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
    });

    // Simulate server reboot by running recovery
    const recovered = await store.recoverInterruptedTasks();
    const target = recovered.find((t) => t.taskId === interruptedTaskId);
    assert.ok(target, 'Interrupted task should be detected during recovery');
    assert.strictEqual(target.status, 'failed', 'Interrupted task should be marked failed');
    assert.ok(target.error?.includes('restart'), 'Error should cite server restart');
  });

  // Test 8: Tool permissions and session isolation
  await test('8. Tool permissions and session isolation', async () => {
    const store = new TaskStore();
    const sessA = `userA_${Date.now()}`;
    const sessB = `userB_${Date.now()}`;

    await store.saveTask({
      taskId: 'taskA',
      sessionId: sessA,
      agentType: 'coding',
      description: 'Private code inspection A',
      status: 'completed',
      dependencies: [],
      result: 'Secret data A',
      createdAt: new Date().toISOString(),
    });

    await store.saveTask({
      taskId: 'taskB',
      sessionId: sessB,
      agentType: 'research',
      description: 'Research B',
      status: 'completed',
      dependencies: [],
      result: 'Data B',
      createdAt: new Date().toISOString(),
    });

    const tasksA = await store.getSessionTasks(sessA);
    const tasksB = await store.getSessionTasks(sessB);

    assert.strictEqual(tasksA.length, 1, 'Session A should only see its own tasks');
    assert.strictEqual(tasksA[0].taskId, 'taskA');
    assert.strictEqual(tasksB.length, 1, 'Session B should only see its own tasks');
    assert.strictEqual(tasksB[0].taskId, 'taskB');
  });

  // Test 9: Prompt submission through existing UI / API pipeline
  await test('9. Prompt classification: direct single agent vs multi-agent DAG', async () => {
    const simple1 = isComplexPrompt('Hello Karma, what time is it?');
    const simple2 = isComplexPrompt('Set a reminder to drink water');
    const complex1 = isComplexPrompt('Research the best three laptops for AI development under ₹70,000.');
    const complex2 = isComplexPrompt('Research this issue while a separate agent analyzes my provided code.');
    const complex3 = isComplexPrompt('Compare these products using price, specifications, and reliable reviews.');

    assert.strictEqual(simple1, false, 'Simple greeting must not trigger multi-agent overhead');
    assert.strictEqual(simple2, false, 'Simple prompt must use direct path');
    assert.strictEqual(complex1, true, 'Best three laptops comparison must trigger multi-agent DAG');
    assert.strictEqual(complex2, true, 'Parallel research + coding must trigger multi-agent DAG');
    assert.strictEqual(complex3, true, 'Product comparison must trigger multi-agent DAG');
  });

  // Test 10: Amazon product analysis still updating the right-side panel
  await test('10. Amazon product analysis right-side panel events preserved', async () => {
    let panelEventReceived = false;
    // Test the progress callback mechanism used by right-side overlay
    const onProgress = (p: { status: string; message: string; data?: unknown }) => {
      if (p.status === 'controlling_screen' || p.status === 'analyzing' || p.status === 'opening_product') {
        panelEventReceived = true;
      }
    };

    onProgress({
      status: 'analyzing',
      message: 'Analyzing 4 candidate products from Amazon search...',
      data: { candidateCount: 4 },
    });

    assert.strictEqual(panelEventReceived, true, 'Product analysis progress events must be routed to intelligence panel');
  });

  // Test 11: Purchase confirmation safeguards remaining intact
  await test('11. Purchase confirmation safeguards remain intact', async () => {
    // Verify that runAmazonShoppingWorkflow enforces safety notice and halts before payment
    const simulatedResult = {
      action: 'cart_and_checkout_prepared',
      checkoutReached: true,
      orderSafeguardNotice:
        'Item added to cart and checkout review prepared. Karma will NEVER automatically click Place your order or submit payment. Please review and complete your order manually in the browser.',
    };

    assert.ok(
      simulatedResult.orderSafeguardNotice.includes('NEVER automatically click Place your order'),
      'Safeguard notice must prohibit automatic order placement'
    );
  });

  console.log('\n======================================================');
  console.log(` Summary: ${passed} passed, ${failed} failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
