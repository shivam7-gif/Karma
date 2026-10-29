import 'dotenv/config';
import { mcpManager } from '../src/mcp/client.js';

async function main() {
  console.log('Testing MCP Discovery of Code Tools...');
  const tools = await mcpManager.getLLMTools();
  const toolNames = tools.map((t) => t.function.name);
  console.log('Discovered tools count:', tools.length);
  
  const codeTools = [
    'code_open_repository',
    'code_list_files',
    'code_read_file',
    'code_search',
    'code_git_status',
    'code_git_diff',
    'code_propose_edit',
  ];

  const missing = codeTools.filter((t) => !toolNames.includes(t));
  if (missing.length > 0) {
    console.error('❌ Missing code tools:', missing);
    process.exit(1);
  }
  console.log('✅ All 7 Code MCP tools discovered by LLM tool definition pipeline!');

  for (const name of codeTools) {
    const def = tools.find((t) => t.function.name === name);
    console.log(`- ${name}: ${def?.function.description.slice(0, 70)}...`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

