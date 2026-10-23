import 'dotenv/config';
import { appBuilderService } from '../src/services/appBuilder/appBuilderService.js';
import { isAppBuildingPrompt } from '../src/services/appBuilder/specificationBuilder.js';

async function testPromptInteractive() {
  const prompt = process.argv[2] ||
    'Create a responsive food delivery app with customer authentication, restaurant listings, search, cart, checkout, order tracking, and an admin dashboard.';

  console.log('================================================================');
  console.log('Karma AI App Builder: Live Prompt Tester');
  console.log('================================================================');
  console.log(`Prompt: "${prompt}"\n`);

  // 1. Classification check
  const isApp = isAppBuildingPrompt(prompt);
  console.log(`1. Intent Classification: ${isApp ? '✅ Recognized as App Building Request' : '❌ Not Recognized'}`);

  if (!isApp) {
    console.log('Exiting because prompt was not classified as app building.');
    return;
  }

  // 2. Determine provider preference from prompt or CLI arg
  let providerOverride: 'auto' | 'manus' | 'replit' = 'auto';
  if (process.argv.includes('--manus') || /\b(manus)\b/i.test(prompt)) providerOverride = 'manus';
  if (process.argv.includes('--replit') || /\b(replit)\b/i.test(prompt)) providerOverride = 'replit';
  console.log(`2. Provider Override: [${providerOverride.toUpperCase()}]\n`);

  console.log('3. Streaming execution progress:');
  console.log('----------------------------------------------------------------');

  const startTime = Date.now();
  const execution = await appBuilderService.buildApp(prompt, {
    sessionId: `test-session-${Date.now()}`,
    userId: 'test-user',
    providerOverride,
    onProgress: (evt) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  [+${elapsed}s] [${evt.status.toUpperCase()}] ${evt.message}`);
    },
  });

  console.log('----------------------------------------------------------------\n');
  console.log('4. Selected Provider:', execution.selectedProviderName);
  console.log('5. Selection Reason:', execution.selectionReason);
  console.log('6. Task Status:', execution.result.status);
  if (execution.result.continueActionUrl) {
    console.log('7. Action URL:', execution.result.continueActionUrl);
  }
  if (execution.result.previewUrl) {
    console.log('8. Preview URL:', execution.result.previewUrl);
  }

  console.log('\n================================================================');
  console.log('Chat Response Markdown Rendered:');
  console.log('================================================================\n');
  console.log(execution.formattedChatResponse);
}

testPromptInteractive().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
