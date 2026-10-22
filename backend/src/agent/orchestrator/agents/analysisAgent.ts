import type { AgentContext, AgentResult } from '../types.js';
import { callAgentLLM } from '../llmHelper.js';

export async function runAnalysisAgent(ctx: AgentContext): Promise<AgentResult> {
  const { task, signal, onActivity, dependencyResults } = ctx;
  onActivity('Aggregating evidence and cross-checking task results...');

  if (signal.aborted) {
    throw new Error('Analysis task cancelled');
  }

  let evidence = '';
  for (const [depId, res] of dependencyResults.entries()) {
    evidence += `\n--- Evidence from Task [${depId}] ---\n${res}\n`;
  }

  onActivity('Evaluating calculations, discrepancies, and gaps in evidence...');

  const systemPrompt = `You are Karma's Specialist Analysis Agent.
Role:
- Compare structured results from multiple sources or tasks.
- Validate any mathematical calculations, price comparisons, or budget constraints.
- Identify discrepancies, contradictions, or missing evidence across sources.
- Give an objective, critical assessment without sugarcoating or glossing over weaknesses.`;

  const userPrompt = `Analysis Request: "${task.description}"

Data to Analyze:
${evidence || 'No prior evidence provided; evaluate the prompt based on analytical reasoning.'}

Provide your structured output:
### Comparative Matrix / Evaluation
[Direct side-by-side comparison of options or code patterns]

### Calculations & Constraint Checks
[Validation of budget, performance, trade-offs, or math]

### Contradictions or Missing Evidence
[Points where data disagrees or critical info is missing]

### Verdict / Recommendation
[Clear, data-driven conclusion]`;

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
    },
  };
}
