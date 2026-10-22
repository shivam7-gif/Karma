import { mcpManager, MultiMcpManager } from './mcp/client.js';

async function runTests() {
  console.log('====================================================');
  console.log('Running Automatic LLM + Multi-MCP Agent Test Suite');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Tool Discovery
  try {
    console.log('[Test 1] Tool Discovery from Karma MCP Server...');
    const tools = await mcpManager.discoverTools();
    console.log(`Discovered ${tools.length} tools:`, tools.map((t) => t.name).join(', '));
    if (tools.length >= 8 && tools.some((t) => t.name === 'search_products')) {
      console.log('✅ PASSED: Discovered all tools successfully.\n');
      passed++;
    } else {
      throw new Error(`Expected at least 8 tools, got ${tools.length}`);
    }
  } catch (err) {
    console.error('❌ FAILED Test 1:', err);
    failed++;
  }

  // Test 2: Test B - Shopping Tool Execution (Karma MCP + SerpAPI)
  try {
    console.log('[Test 2] Test B: Shopping Tool (search_products under ₹1,000)...');
    const res = await mcpManager.executeTool('search_products', {
      query: 'creatine monohydrate',
      maxPrice: 1000,
      limit: 3,
    });
    console.log(`Tool execution status: success=${res.success}, duration=${res.durationMs}ms`);
    if (res.success && res.result.includes('products')) {
      console.log('Sample result output snippet:', res.result.slice(0, 200).replace(/\n/g, ' '), '...');
      console.log('✅ PASSED: Shopping tool executed successfully through Karma MCP.\n');
      passed++;
    } else {
      throw new Error(`Shopping tool failed: ${res.result}`);
    }
  } catch (err) {
    console.error('❌ FAILED Test 2:', err);
    failed++;
  }

  // Test 3: Test C - Travel Planner Tool
  try {
    console.log('[Test 3] Test C: Travel Planner Tool (Jaipur)...');
    const res = await mcpManager.executeTool('travel_planner', {
      destination_query: 'Jaipur',
      mode: 'itinerary',
    });
    console.log(`Tool execution status: success=${res.success}, duration=${res.durationMs}ms`);
    if (res.success && res.result.includes('Jaipur')) {
      console.log('Sample itinerary snippet:', res.result.slice(0, 150).replace(/\n/g, ' '), '...');
      console.log('✅ PASSED: Travel planner tool executed successfully.\n');
      passed++;
    } else {
      throw new Error(`Travel planner tool failed: ${res.result}`);
    }
  } catch (err) {
    console.error('❌ FAILED Test 3:', err);
    failed++;
  }

  // Test 4: Test D - Tool Failure and Server Offline Graceful Handling
  try {
    console.log('[Test 4] Test D: Tool Failure / Offline Server Fallback...');
    // A: Non-existent tool
    const missingRes = await mcpManager.executeTool('non_existent_tool', {});
    if (!missingRes.success && missingRes.error === 'TOOL_NOT_FOUND') {
      console.log('Sub-check A: Handled missing tool cleanly without crashing.');
    } else {
      throw new Error('Failed to handle missing tool');
    }

    // B: Offline MCP Server
    const testMultiManager = new MultiMcpManager([
      { id: 'offline_server', name: 'Offline Server', url: 'http://localhost:59999/mcp' },
    ]);
    const offlineRes = await testMultiManager.executeTool('offline_tool', {});
    if (!offlineRes.success) {
      console.log('Sub-check B: Handled offline server cleanly without throwing uncaught exception.');
    }
    console.log('✅ PASSED: Tool failure & offline server error handling verified.\n');
    passed++;
  } catch (err) {
    console.error('❌ FAILED Test 4:', err);
    failed++;
  }

  // Test 5: Test E - Safety & Permission Gating
  try {
    console.log('[Test 5] Test E: Safety Gating on Consequential Actions...');
    // Attempting state modification without confirmation
    const blockedRes = await mcpManager.executeTool('home_assistant_core', {
      query: 'turn off living room lights',
      state: 'off',
    });

    if (blockedRes.requiresConfirmation && blockedRes.result.includes('Safety Confirmation Required')) {
      console.log('Sub-check A: Action properly blocked requiring confirmation.');
    } else {
      throw new Error('Consequential action was not blocked for confirmation!');
    }

    // Attempting same action with confirmation
    const allowedRes = await mcpManager.executeTool(
      'home_assistant_core',
      { query: 'turn off living room lights', state: 'off' },
      { confirmed: true }
    );
    if (allowedRes.success) {
      console.log('Sub-check B: Action allowed when explicitly confirmed.');
    } else {
      throw new Error(`Confirmed action failed: ${allowedRes.result}`);
    }
    console.log('✅ PASSED: Consequential actions safety gating verified.\n');
    passed++;
  } catch (err) {
    console.error('❌ FAILED Test 5:', err);
    failed++;
  }

  console.log('====================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('====================================================');

  await mcpManager.closeAll();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
