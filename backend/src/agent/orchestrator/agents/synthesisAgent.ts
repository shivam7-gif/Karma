import type { AgentContext, AgentResult } from '../types.js';
import { callAgentLLM } from '../llmHelper.js';

export async function runSynthesisAgent(ctx: AgentContext): Promise<AgentResult> {
  const { task, signal, onActivity, dependencyResults } = ctx;
  onActivity('Synthesizing completed agent outputs into unified response...');

  if (signal.aborted) {
    throw new Error('Synthesis task cancelled');
  }

  const allCitations: string[] = [];
  let combinedInputs = '';

  for (const [depId, res] of dependencyResults.entries()) {
    combinedInputs += `\n### Result from [${depId}]:\n${res}\n`;

    // Extract URLs from result
    const urlMatches = res.match(/https?:\/\/[^\s)\]"]+/g) || [];
    for (const u of urlMatches) {
      if (!allCitations.includes(u)) {
        allCitations.push(u);
      }
    }
  }

  onActivity('Formatting comprehensive final answer with honest citations...');

  const systemPrompt = `You are Karma's Synthesis Agent.
Role:
- Combine all completed task results into a single, cohesive, authoritative, beautifully formatted markdown response.
- Preserve all source citations and links faithfully.
- Report any failed, missing, or incomplete tasks honestly and transparently.
- DO NOT invent or hallucinate findings from agents that had no evidence.
- Present the final answer cleanly to the user.`;

  const userPrompt = `User's Original Request: "${task.description}"

Collected Agent Results:
${combinedInputs || 'No prior agent results available.'}

Synthesize these findings into an exhaustive, easy-to-read final answer.`;

  const response = await callAgentLLM(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    undefined,
    {
      signal,
      temperature: 0.1,
    }
  );

  return {
    success: true,
    output: response.text,
    citations: allCitations,
    metadata: {
      citationsCount: allCitations.length,
      synthesizedTasksCount: dependencyResults.size,
    },
  };
}
