import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { workspaceService } from '../src/services/workspaceService.js';
import { terminalService } from '../src/services/terminalService.js';
import { codingWorkflowService } from '../src/services/codingWorkflowService.js';

async function runTests() {
  console.log('=== Running Karma IDE & VS Code Integration Tests ===\n');

  // Test 1: Workspace root & scanning
  console.log('1. Testing workspace root & scanning...');
  const root = workspaceService.getRoot();
  assert(root && fs.existsSync(root), 'Root directory must exist');
  const projectScan = await workspaceService.scanProject();
  console.log(`   Project Name: ${projectScan.name}`);
  console.log(`   Detected Stack: ${projectScan.stack.join(', ')}`);
  assert(Array.isArray(projectScan.stack), 'Stack should be an array');
  console.log('   ✓ Workspace scanning passed');

  // Test 2: Tree Discovery
  console.log('2. Testing workspace tree traversal...');
  const tree = workspaceService.getTree('', 2);
  assert(tree.length > 0, 'Tree should have top-level nodes');
  assert(tree.some((n) => n.name === 'backend'), 'Tree should contain backend folder');
  console.log(`   Found ${tree.length} top-level entries.`);
  console.log('   ✓ Workspace tree traversal passed');

  // Test 3: Path Sandboxing Security
  console.log('3. Testing path sandboxing & directory traversal rejection...');
  assert.throws(
    () => {
      workspaceService.getSafeFullPath('../../../Windows/System32/calc.exe');
    },
    /Access Denied/,
    'Should reject path traversal out of workspace root'
  );
  console.log('   ✓ Security sandboxing enforced');

  // Test 4: File Write, Read, Hash, and Stale Overwrite Protection
  console.log('4. Testing file CRUD and stale-write rejection...');
  const testFileRel = 'test_sample_ide_temp.txt';
  const initialContent = 'Hello Karma IDE Engine';
  const writeRes = await workspaceService.writeFile(testFileRel, initialContent);
  assert(writeRes.success, 'Initial write must succeed');
  assert(writeRes.hash, 'Write must return SHA256 hash');

  const readBack = await workspaceService.readFile(testFileRel);
  assert.strictEqual(readBack.content, initialContent, 'Content must match');
  assert.strictEqual(readBack.hash, writeRes.hash, 'Hash must match');

  // Attempt stale write with old/wrong expectedHash
  let staleRejected = false;
  try {
    await workspaceService.writeFile(testFileRel, 'Changed content', 'wrong_fake_hash_123');
  } catch (err: any) {
    if (err.message.includes('Stale write rejected')) {
      staleRejected = true;
    }
  }
  assert(staleRejected, 'Stale write must be rejected with error');
  console.log('   ✓ Stale write detection passed');

  // Cleanup file
  await workspaceService.deleteEntry(testFileRel);
  console.log('   ✓ Temporary file cleaned up');

  // Test 5: Terminal Process & Security Whitelist
  console.log('5. Testing terminal process manager & sandbox whitelist...');
  // Command not in whitelist should be rejected
  let blocked = false;
  try {
    terminalService.startProcess('powershell.exe -Command Remove-Item -Force -Recurse C:\\');
  } catch (err: any) {
    if (err.message.includes('Security Policy')) {
      blocked = true;
    }
  }
  assert(blocked, 'Disallowed command must be blocked by security policy');
  console.log('   ✓ Command policy whitelist enforcement passed');

  // Allowed command
  const proc = terminalService.startProcess('node -v');
  assert(proc.processId, 'Process ID must be generated');
  await new Promise<void>((res) => {
    if (proc.exitCode !== null) return res();
    const interval = setInterval(() => {
      if (proc.exitCode !== null) {
        clearInterval(interval);
        res();
      }
    }, 100);
    setTimeout(() => {
      clearInterval(interval);
      res();
    }, 5000);
  });
  assert(proc.exitCode === 0, 'node -v should exit with 0');
  console.log(`   Node version in terminal: ${proc.outputBuffer.join(' ').trim()}`);
  console.log('   ✓ Terminal process execution passed');

  // Test 6: Live Port Detection
  console.log('6. Testing live port detection...');
  const livePorts = await terminalService.detectLivePorts([5173, 3000, 3001, 8080]);
  console.log(`   Detected live ports: ${livePorts.join(', ') || 'none currently listening'}`);
  console.log('   ✓ Port scanner passed');

  // Test 7: Diff Generator & Patch Proposal
  console.log('7. Testing diff generation and patch management...');
  const original = 'function greet() {\n  return "hi";\n}';
  const proposed = 'function greet() {\n  return "hello karma";\n}';
  const diff = codingWorkflowService.generateDiff(original, proposed, 'greet.ts');
  assert(diff.includes('-  return "hi";'), 'Diff must show deletion');
  assert(diff.includes('+  return "hello karma";'), 'Diff must show addition');
  console.log('   Diff snippet:\n' + diff);
  console.log('   ✓ Diff generator passed');

  console.log('\n=== ALL INTEGRATION TESTS PASSED CLEANLY! ===\n');
}

runTests().catch((err) => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
