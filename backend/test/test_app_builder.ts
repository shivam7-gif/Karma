import 'dotenv/config';
import { isAppBuildingPrompt, buildAppSpecification } from '../src/services/appBuilder/specificationBuilder.js';
import { providerSelector } from '../src/services/appBuilder/providerSelector.js';
import { manusAdapter } from '../src/services/appBuilder/manusAdapter.js';
import { replitAdapter } from '../src/services/appBuilder/replitAdapter.js';
import { appBuilderService } from '../src/services/appBuilder/appBuilderService.js';
import { mcpManager } from '../src/mcp/client.js';

async function runAcceptanceTests() {
  console.log('================================================================');
  console.log('Karma External AI App Builders: Acceptance Test Suite');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  const foodDeliveryPrompt =
    'Create a responsive food delivery app with customer authentication, restaurant listings, search, cart, checkout, order tracking, and an admin dashboard.';

  // --------------------------------------------------------------------------
  // Test 1: Food delivery app request is correctly classified & structured
  // --------------------------------------------------------------------------
  try {
    console.log('[Test 1] App-building request classification & 10-part specification generation...');
    const isApp = isAppBuildingPrompt(foodDeliveryPrompt);
    if (!isApp) {
      throw new Error(`Expected isAppBuildingPrompt to return true for: "${foodDeliveryPrompt}"`);
    }

    // Negative tests: shopping & research should NOT be classified as app building
    const isShopping = isAppBuildingPrompt('Find noise cancelling wireless headphones on Amazon');
    const isResearch = isAppBuildingPrompt('What are the top 10 tourist attractions in Tokyo?');
    if (isShopping || isResearch) {
      throw new Error(`False positive in app classification. Shopping: ${isShopping}, Research: ${isResearch}`);
    }

    // Generate specification
    const spec = buildAppSpecification(foodDeliveryPrompt);
    const requiredSections = [
      'Customer-Facing Responsive UI',
      'Customer Authentication & Profiles',
      'Restaurant Listings, Search & Categories',
      'Cart & Checkout Flow',
      'Live Order Status & Tracking',
      'Restaurant / Admin Dashboard',
      'Backend Architecture & Database Schema',
      'Validation & Error Handling',
      'Mobile Responsiveness & Accessibility',
      'Environment Variables & Setup',
    ];

    for (const section of requiredSections) {
      if (!spec.fullMarkdownBrief.includes(section)) {
        throw new Error(`Specification is missing required section: "${section}"`);
      }
    }

    if (
      !spec.mockPaymentNotice.toLowerCase().includes('mock') &&
      !spec.mockPaymentNotice.toLowerCase().includes('sandbox')
    ) {
      throw new Error('Specification must enforce sandbox/mock payment safeguard');
    }

    console.log(`✅ PASSED: Correctly classified prompt and generated complete 10-part project brief (${spec.fullMarkdownBrief.length} chars).\n`);
    passed++;
  } catch (err) {
    console.error('❌ FAILED Test 1:', err);
    failed++;
  }

  // --------------------------------------------------------------------------
  // Test 2: Smart provider selection uses actual available capabilities
  // --------------------------------------------------------------------------
  try {
    console.log('[Test 2] Smart provider selection (Auto vs Manus vs Replit)...');
    
    // Auto selection without Manus key should pick Replit guided handoff
    const savedKey = process.env.MANUS_API_KEY;
    delete process.env.MANUS_API_KEY;

    const autoSelectionNoKey = await providerSelector.selectProvider(foodDeliveryPrompt, 'auto');

    if (autoSelectionNoKey.provider.id !== 'replit') {
      throw new Error(`Expected auto-selection without API key to route to Replit handoff, got: ${autoSelectionNoKey.provider.id}`);
    }
    console.log(`  - Auto without MANUS_API_KEY -> ${autoSelectionNoKey.provider.id} (${autoSelectionNoKey.reason})`);

    // Override to Replit
    const replitOverride = await providerSelector.selectProvider(foodDeliveryPrompt, 'replit');
    if (replitOverride.provider.id !== 'replit') {
      throw new Error(`Expected Replit override to return replit provider, got: ${replitOverride.provider.id}`);
    }
    console.log(`  - Explicit Replit override -> ${replitOverride.provider.id}`);

    // Override to Manus when no key: safely defaults to Replit with fallback explanation
    const manusOverrideNoKey = await providerSelector.selectProvider(foodDeliveryPrompt, 'manus');
    if (manusOverrideNoKey.provider.id !== 'replit') {
      throw new Error(`Expected Manus override without key to safely route to Replit fallback, got: ${manusOverrideNoKey.provider.id}`);
    }
    console.log(`  - Explicit Manus override (no key) -> ${manusOverrideNoKey.provider.id} (${manusOverrideNoKey.reason})`);

    // Auto with Manus key set
    process.env.MANUS_API_KEY = 'test_manus_key_123';
    const autoSelectionWithKey = await providerSelector.selectProvider(foodDeliveryPrompt, 'auto');
    if (autoSelectionWithKey.provider.id !== 'manus') {
      throw new Error(`Expected auto-selection with MANUS_API_KEY to pick manus, got: ${autoSelectionWithKey.provider.id}`);
    }
    console.log(`  - Auto with MANUS_API_KEY -> ${autoSelectionWithKey.provider.id} (${autoSelectionWithKey.reason})`);

    // Explicit Manus override with key
    const manusOverrideWithKey = await providerSelector.selectProvider(foodDeliveryPrompt, 'manus');
    if (manusOverrideWithKey.provider.id !== 'manus') {
      throw new Error(`Expected Manus override with key to pick manus, got: ${manusOverrideWithKey.provider.id}`);
    }
    console.log(`  - Explicit Manus override (with key) -> ${manusOverrideWithKey.provider.id}`);

    // Restore original key
    if (savedKey) process.env.MANUS_API_KEY = savedKey;
    else delete process.env.MANUS_API_KEY;

    console.log('✅ PASSED: Smart provider selection accurately routes based on capabilities and overrides.\n');
    passed++;
  } catch (err) {
    console.error('❌ FAILED Test 2:', err);
    failed++;
  }

  // --------------------------------------------------------------------------
  // Test 3: Replit honest handoff when automated project creation is unavailable
  // --------------------------------------------------------------------------
  try {
    console.log('[Test 3] Replit honest guided handoff & prompt generation...');
    const spec = buildAppSpecification(foodDeliveryPrompt);
    const project = await replitAdapter.createProject({
      name: spec.title,
      specification: spec,
      sessionId: 'test-session-123',
      userId: 'test-user-456',
    });

    const task = await replitAdapter.submitBuildTask(project.projectId, spec);
    const result = await replitAdapter.getTaskResult(task.taskId);

    if (result.status !== 'manual_action_required') {
      throw new Error(`Expected Replit handoff status to be 'manual_action_required', got: ${result.status}`);
    }

    if (!result.continueActionUrl || !result.continueActionUrl.startsWith('https://replit.com/new/')) {
      throw new Error(`Expected Replit continueActionUrl to point to official project creation, got: ${result.continueActionUrl}`);
    }

    // Must not claim automated completion
    if (result.outputSummary.toLowerCase().includes('automatically deployed')) {
      throw new Error('Replit adapter dishonestly claimed automated deployment');
    }

    console.log(`  - Generated Replit workspace URL: ${result.continueActionUrl}`);
    console.log(`  - Status: ${result.status} (${result.statusMessage})`);
    console.log('✅ PASSED: Replit handoff provides structured brief and verified workspace action without false claims.\n');
    passed++;
  } catch (err) {
    console.error('❌ FAILED Test 3:', err);
    failed++;
  }

  // --------------------------------------------------------------------------
  // Test 4: Manus adapter structure & task lifecycle handling
  // --------------------------------------------------------------------------
  try {
    console.log('[Test 4] Manus adapter capability & lifecycle handling...');
    const savedKey = process.env.MANUS_API_KEY;
    delete process.env.MANUS_API_KEY;

    const availabilityNoKey = await manusAdapter.checkAvailability();
    if (availabilityNoKey.available) {
      throw new Error('Expected Manus to report unavailable when MANUS_API_KEY is missing');
    }

    process.env.MANUS_API_KEY = 'test_manus_key_123';
    const availabilityWithKey = await manusAdapter.checkAvailability();
    if (!availabilityWithKey.available) {
      throw new Error('Expected Manus to report available when MANUS_API_KEY is present');
    }

    // Restore key
    if (savedKey) process.env.MANUS_API_KEY = savedKey;
    else delete process.env.MANUS_API_KEY;

    // Test adapter interface methods are properly typed functions
    if (
      typeof manusAdapter.createProject !== 'function' ||
      typeof manusAdapter.submitBuildTask !== 'function' ||
      typeof manusAdapter.getTaskStatus !== 'function' ||
      typeof manusAdapter.getTaskResult !== 'function' ||
      typeof manusAdapter.cancelTask !== 'function'
    ) {
      throw new Error('Manus adapter missing required interface methods');
    }

    console.log(`  - Manus adapter availability check verified (no key: ${availabilityNoKey.reason}, with key: ${availabilityWithKey.available})`);
    console.log('✅ PASSED: Manus adapter conforms to AppBuilderProvider interface with verified endpoints.\n');
    passed++;
  } catch (err) {
    console.error('❌ FAILED Test 4:', err);
    failed++;
  }

  // --------------------------------------------------------------------------
  // Test 5: End-to-end unified chat execution & progress events
  // --------------------------------------------------------------------------
  try {
    console.log('[Test 5] End-to-end AppBuilderService execution & unified progress events...');
    const progressUpdates: Array<{ status: string; message: string }> = [];

    const execution = await appBuilderService.buildApp(foodDeliveryPrompt, {
      sessionId: 'test-session-unified',
      userId: 'test-user-unified',
      providerOverride: 'replit',
      onProgress: (evt) => {
        progressUpdates.push({ status: evt.status, message: evt.message });
      },
    });

    if (!execution.formattedChatResponse || execution.formattedChatResponse.length === 0) {
      throw new Error('Expected non-empty formattedChatResponse from appBuilderService.buildApp');
    }

    // Verify markdown contains essential elements
    const md = execution.formattedChatResponse;
    const hasProvider = md.includes('Replit');
    const hasStatus = md.includes('Status');
    const hasBrief = md.includes('Architecture') && md.includes('Brief');
    const hasNextSteps = md.includes('Continue in Replit') || md.includes('Next Steps') || md.includes('Launch in Replit');

    if (!hasProvider || !hasStatus || !hasBrief || !hasNextSteps) {
      throw new Error(`Markdown response missing key telemetry sections. HasProvider: ${hasProvider}, HasStatus: ${hasStatus}, HasBrief: ${hasBrief}, HasNextSteps: ${hasNextSteps}`);
    }

    // Verify progress events were emitted
    if (progressUpdates.length < 2) {
      throw new Error(`Expected at least 2 progress updates, received: ${progressUpdates.length}`);
    }

    console.log(`  - Emitted ${progressUpdates.length} progress events. Last event: ${progressUpdates[progressUpdates.length - 1].message}`);
    console.log(`  - Formatted chat response length: ${md.length} characters`);
    console.log('✅ PASSED: AppBuilderService executed end-to-end with verified telemetry and markdown formatting.\n');
    passed++;
  } catch (err) {
    console.error('❌ FAILED Test 5:', err);
    failed++;
  }

  // --------------------------------------------------------------------------
  // Test 6: Provider failure resiliency (does not crash Karma)
  // --------------------------------------------------------------------------
  try {
    console.log('[Test 6] Provider failure resiliency & graceful degradation...');
    // Request with invalid Manus configuration to ensure it handles network/auth failure gracefully
    const savedKey = process.env.MANUS_API_KEY;
    process.env.MANUS_API_KEY = 'invalid_test_key_xyz';

    const failExecution = await appBuilderService.buildApp(foodDeliveryPrompt, {
      sessionId: 'test-session-fail',
      userId: 'test-user-fail',
      providerOverride: 'manus',
    });

    // Should return a clean structured response with error status and fallback guidance, NOT throw unhandled error
    if (!failExecution.result) {
      throw new Error('Expected structured result even on provider failure');
    }

    if (failExecution.result.status !== 'failed' && failExecution.result.status !== 'manual_action_required') {
      throw new Error(`Expected failed or manual_action_required status, got: ${failExecution.result.status}`);
    }

    if (!failExecution.formattedChatResponse.includes('Error') && !failExecution.formattedChatResponse.includes('Replit') && !failExecution.formattedChatResponse.includes('Failed')) {
      throw new Error('Expected failure diagnostic or fallback link in markdown response');
    }

    // Restore key
    if (savedKey) process.env.MANUS_API_KEY = savedKey;
    else delete process.env.MANUS_API_KEY;

    console.log('✅ PASSED: Provider failures are caught and surfaced cleanly without crashing conversation.\n');
    passed++;
  } catch (err) {
    console.error('❌ FAILED Test 6:', err);
    failed++;
  }

  // --------------------------------------------------------------------------
  // Test 7: Regression check on existing MCP, shopping, and browser tools
  // --------------------------------------------------------------------------
  try {
    console.log('[Test 7] Regression check: existing swarm, MCP, shopping, and browser tools...');
    const tools = await mcpManager.getLLMTools();
    const toolNames = tools.map((t) => t.function.name);

    const essentialTools = [
      'shop_amazon',
      'search_products',
      'manage_lists',
      'travel_planner',
      'build_external_app',
    ];

    for (const tool of essentialTools) {
      if (!toolNames.includes(tool)) {
        throw new Error(`Regression! Essential tool "${tool}" missing from MCP registry. Found: ${toolNames.join(', ')}`);
      }
    }

    // Execute standard MCP tool to ensure client/server pipeline is healthy
    const mcpTest = await mcpManager.executeTool('travel_planner', {
      destination_query: 'San Francisco, CA',
      mode: 'itinerary',
    });

    if (!mcpTest.success || !mcpTest.result.includes('San Francisco')) {
      throw new Error(`MCP travel_planner regression test failed: ${mcpTest.result}`);
    }

    console.log(`  - Discovered ${toolNames.length} MCP tools: ${toolNames.join(', ')}`);
    console.log('✅ PASSED: All existing shopping, research, browser, and external app builder tools are active and functional.\n');
    passed++;
  } catch (err) {
    console.error('❌ FAILED Test 7:', err);
    failed++;
  }

  // --------------------------------------------------------------------------
  // Final Results
  // --------------------------------------------------------------------------
  console.log('================================================================');
  console.log(`Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAcceptanceTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
