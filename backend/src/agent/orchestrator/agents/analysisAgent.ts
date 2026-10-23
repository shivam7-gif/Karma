import type { AgentContext, AgentResult } from '../types.js';
import { callAgentLLM } from '../llmHelper.js';

export async function runAnalysisAgent(ctx: AgentContext): Promise<AgentResult> {
  const { task, signal, onActivity, dependencyResults } = ctx;
  onActivity('Aggregating evidence across independent specialist workers...');

  if (signal.aborted) {
    throw new Error('Analysis task cancelled');
  }

  let evidence = '';
  let successfulDeps = 0;
  let partialFailureNotes = '';

  for (const [depId, res] of dependencyResults.entries()) {
    if (res.startsWith('ERROR:') || res.includes('failed') || res.includes('halted')) {
      partialFailureNotes += `- Specialist Task [${depId}] reported failure or incomplete results: ${res}\n`;
    } else {
      successfulDeps++;
      evidence += `\n--- Output from Task [${depId}] ---\n${res}\n`;
    }
  }

  onActivity('Evaluating budget constraints, cost calculations, and feasibility...');

  const systemPrompt = `You are Karma's Specialist Budget & Analysis Agent.
Role:
- Perform precise numerical analysis and budget aggregation based strictly on the outputs from specialist tasks.
- If any specialist task failed or data was unavailable, compute with partial results, use realistic industry estimates, and clearly flag what is an estimate versus verified data.
- Construct a detailed, clear Markdown table of estimated costs by category:
  | Category | Detail / Selection | Estimated Cost (INR) | Verification Status |
  | Accommodation | ... | ₹... | Verified / Estimated |
  | Intercity & Local Transport | ... | ₹... | Verified / Estimated |
  | Sightseeing & Monument Tickets | ... | ₹... | Verified / Estimated |
  | Meals & Daily Buffer | ... | ₹... | Estimated Assumption |
  | Emergency Contingency | ... | ₹... | Buffer |
  | **TOTAL ESTIMATED COST** | ... | **₹...** | Feasible / Exceeds Budget |
- Explicitly compare Total Estimated Cost against the target budget (e.g. ₹10,000).
- State the remaining surplus or deficit clearly.
- List all underlying assumptions (e.g. sharing type, travel class, booking season).`;

  const userPrompt = `Analysis Request: "${task.description}"

Specialist Outputs Collected (${successfulDeps} successful):
${evidence || 'No successful upstream agent outputs available.'}

${partialFailureNotes ? `Notices on Incomplete Specialist Tasks:\n${partialFailureNotes}` : ''}

Provide your structured output:
### Budget Feasibility & Cost Breakdown
[Markdown table with itemized costs in INR and remaining buffer]

### Constraint & Math Verification
[Step-by-step math check comparing total vs target limit]

### Key Assumptions & Trade-offs
[Explicit assumptions made regarding accommodation type, transport modes, timing]

### Data Gaps & Confidence Level
[Assessment of accuracy and any unverified items]`;

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
    metadata: {
      dependenciesAnalyzed: Array.from(dependencyResults.keys()),
      successfulCount: successfulDeps,
      hasPartialFailures: Boolean(partialFailureNotes),
    },
  };
}
