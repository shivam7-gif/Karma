import type { AgentContext, AgentResult } from '../types.js';
import { callAgentLLM } from '../llmHelper.js';

export async function runSynthesisAgent(ctx: AgentContext): Promise<AgentResult> {
  const { task, signal, onActivity, dependencyResults } = ctx;
  onActivity('Chief Planner synthesizing all specialist task outputs into master itinerary...');

  if (signal.aborted) {
    throw new Error('Synthesis task cancelled');
  }

  const allCitations: string[] = [];
  let combinedInputs = '';

  for (const [depId, res] of dependencyResults.entries()) {
    combinedInputs += `\n### Result from [Specialist Task ${depId}]:\n${res}\n`;

    // Extract all URLs from result
    const urlMatches = res.match(/https?:\/\/[^\s)\]"]+/g) || [];
    for (const u of urlMatches) {
      if (!allCitations.includes(u)) {
        allCitations.push(u);
      }
    }
  }

  onActivity('Compiling structured day-by-day itinerary, budget totals, and verified citations...');

  const systemPrompt = `You are Karma's Chief Planner & Synthesis Agent.
Role:
- Formulate an authoritative, executive-level, practical response synthesizing the verified results from the specialist agents.
- For trip plans (e.g. 3-day Jaipur trip under ₹10,000):
  1. Produce a detailed day-by-day itinerary (Day 1, Day 2, Day 3) with morning, afternoon, and evening activities, exact monument timings, and local transit advice.
  2. Provide a clear Master Budget Breakdown Table showing estimated costs for Accommodation, Transport, Sightseeing/Tickets, Meals, and Contingency Buffer, with Total vs Budget limit and remaining surplus/margin.
  3. Attribute findings clearly to the contributing specialist agents:
     - 🏨 Accommodation Specialist
     - 🚆 Transport Specialist
     - 🏛️ Attractions & Itinerary Specialist
     - 📊 Budget & Feasibility Analyst
  4. Include a dedicated "Sources & Clickable Citations" section with real markdown links [Title](url).
  5. Include an "Assumptions, Estimates & Caveats" section clearly marking what is estimated vs verified live data.
  6. Include a "Consequential Action Approval Notice": Remind the user that reservations, ticket bookings, or financial transactions require explicit user confirmation before execution.
- If any specialist task encountered issues, report it transparently and provide a useful final answer based on the remaining evidence.`;

  const userPrompt = `Mission Goal: "${task.description}"

Specialist Agent Deliverables:
${combinedInputs || 'No prior agent results available.'}

Compile the final synthesized mission report.`;

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
      completedAt: new Date().toISOString(),
    },
  };
}
