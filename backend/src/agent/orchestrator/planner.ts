import type { AgentType, OrchestratorPlan } from './types.js';
import { callAgentLLM } from './llmHelper.js';
import { logger } from '../../lib/logger.js';

export function isComplexPrompt(prompt: string): boolean {
  const p = prompt.trim().toLowerCase();
  // Simple greetings or trivial queries
  if (/^(hi|hello|hey|good\s+(morning|evening)|who\s+are\s+you|ping|test)[\s!.?]*$/i.test(p)) {
    return false;
  }

  // Direct shopping actions with cart execution should run directly via Karma's MCP shop_amazon tool
  if (/\b(add\s+to\s+cart|add.*cart|buy\s+on\s+amazon|checkout)\b/i.test(p)) {
    return false;
  }

  // Travel, trips, tours, and itineraries (P0 requirement)
  if (
    p.includes('jaipur') ||
    p.includes('trip') ||
    p.includes('itinerary') ||
    p.includes('tour') ||
    p.includes('travel') ||
    p.includes('vacation') ||
    p.includes('holiday') ||
    (p.includes('plan') && (p.includes('day') || p.includes('budget') || p.includes('under') || p.includes('₹') || p.includes('rs')))
  ) {
    return true;
  }

  // Explicit multi-agent / parallel triggers
  if (
    p.includes('while a separate agent') ||
    p.includes('separate agent') ||
    p.includes('independent research') ||
    p.includes('concurrently') ||
    p.includes('in parallel') ||
    p.includes('compare these products') ||
    p.includes('best three') ||
    p.includes('best 3') ||
    p.includes('swarm') ||
    p.includes('mission') ||
    (p.includes('research') && p.includes('code')) ||
    (p.includes('research') && p.includes('compare')) ||
    (p.includes('search') && p.includes('analyze'))
  ) {
    return true;
  }

  // Coding, refactoring, and workspace file queries
  if (
    p.includes('backend/') ||
    p.includes('frontend/') ||
    p.includes('src/') ||
    /\.(ts|tsx|js|jsx|json|md|css|py)\b/i.test(p) ||
    p.includes('refactor') ||
    p.includes('unit test') ||
    p.includes('add a parameter') ||
    p.includes('add an optional') ||
    p.includes('fix the error') ||
    p.includes('codebase') ||
    p.includes('project architecture')
  ) {
    return true;
  }

  // Complex comparison or multi-criteria queries
  if (p.length > 40 && (p.includes('compare') || p.includes('versus') || p.includes('vs') || p.includes('budget of') || p.includes('under ₹'))) {
    return true;
  }

  return false;
}

export async function generatePlan(
  prompt: string,
  sessionId: string,
  options?: { signal?: AbortSignal | undefined; forceMultiAgent?: boolean | undefined } | undefined
): Promise<OrchestratorPlan> {
  const needsMulti = options?.forceMultiAgent ?? isComplexPrompt(prompt);

  if (!needsMulti) {
    return {
      planId: `plan-${Date.now()}`,
      sessionId,
      summary: 'Direct execution plan (single agent)',
      isMultiAgent: false,
      tasks: [],
    };
  }

  const isShoppingProductPrompt =
    /\b(laptop|laptops|shoes|shoe|sneakers|phone|phones|gadget|gadgets|headphone|headphones|product|products|item|items)\b/i.test(prompt) ||
    /\b(buy|shop|cart|amazon)\b/i.test(prompt);

  const isTripPrompt =
    !isShoppingProductPrompt &&
    /\b(trip|itinerary|jaipur|travel|tour|vacation|holiday|getaway|stay|monument|hotel|hostel|flight|train)\b/i.test(prompt);

  // For trip planning missions, ensure the plan strictly follows the required 3 independent specialist pattern
  if (isTripPrompt) {
    return buildTripMissionPlan(prompt, sessionId);
  }

  // For product / shopping multi-agent comparison missions
  if (isShoppingProductPrompt) {
    return buildProductComparisonPlan(prompt, sessionId);
  }

  // Generate DAG plan using LLM or structured rules
  const systemPrompt = `You are Karma's Task Planner.
Break down complex user requests into a clean Directed Acyclic Graph (DAG) of parallel and sequential tasks.
Available specialist agent types:
- "research": searches web, products, specifications, and returns factual citations.
- "browser": automates browser actions, Amazon product lookup/cart, page reading.
- "coding": inspects local project files, analyzes code, tests within sandbox.
- "analysis": compares results, validates math/calculations, cross-checks discrepancies.
- "synthesis": combines all findings into a final authoritative answer.

Rules:
1. Identify independent tasks that can run concurrently (they have empty dependencies: []).
2. Dependent tasks (like analysis or synthesis) must list the taskIds they depend on in "dependencies".
3. The final task should almost always be a "synthesis" task that depends on the previous tasks.
4. Limit the plan to between 2 and 5 tasks total.
5. Return ONLY a valid JSON object matching this schema:
{
  "summary": "Brief summary of the plan",
  "tasks": [
    {
      "taskId": "task-1",
      "agentType": "research",
      "description": "Specific actionable instruction",
      "dependencies": []
    },
    {
      "taskId": "task-2",
      "agentType": "analysis",
      "description": "Specific actionable instruction",
      "dependencies": ["task-1"]
    },
    {
      "taskId": "task-3",
      "agentType": "synthesis",
      "description": "Combine findings",
      "dependencies": ["task-1", "task-2"]
    }
  ]
}`;

  try {
    const response = await callAgentLLM(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Create an execution DAG for prompt: "${prompt}"` },
      ],
      undefined,
      {
        signal: options?.signal,
        temperature: 0.1,
      }
    );

    // Extract JSON block
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
        const validTasks = parsed.tasks.map((t: any, idx: number) => ({
          taskId: String(t.taskId || `task-${idx + 1}`),
          agentType: validateAgentType(t.agentType),
          description: String(t.description || prompt),
          dependencies: Array.isArray(t.dependencies) ? t.dependencies.map(String) : [],
        }));

        return {
          planId: `mission-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sessionId,
          summary: parsed.summary || 'Multi-agent orchestration plan',
          isMultiAgent: true,
          tasks: validTasks,
        };
      }
    }
  } catch (err) {
    logger.warn({ err }, 'LLM planner generation failed; applying deterministic fallback plan');
  }

  // Deterministic fallback plan if LLM is unavailable or times out
  return buildFallbackPlan(prompt, sessionId);
}

function validateAgentType(type: string): AgentType {
  const allowed: AgentType[] = ['research', 'browser', 'coding', 'analysis', 'synthesis'];
  if (allowed.includes(type as AgentType)) {
    return type as AgentType;
  }
  return 'research';
}

function buildTripMissionPlan(prompt: string, sessionId: string): OrchestratorPlan {
  // Extract destination, duration and budget
  const destMatch =
    prompt.match(/\b([A-Z][a-z]+)\s+trip\b/i) ||
    prompt.match(/(?:trip|itinerary|tour|travel|visit)\s+(?:to|for|in)\s+([A-Za-z]+)/i) ||
    prompt.match(/\b(?:in|to)\s+([A-Za-z]+)\b/i);
  const rawDest = destMatch ? destMatch[1] : undefined;
  const destination = rawDest && !/^(day|days|under|budget|the|a|an)$/i.test(rawDest) ? rawDest : 'Jaipur';

  const daysMatch = prompt.match(/(\d+)[\s-]*(?:day|days)/i);
  const days = daysMatch ? `${daysMatch[1]}-day` : '3-day';

  const budgetMatch = prompt.match(/(?:under|below|budget\s*(?:of)?)\s*(?:₹|rs\.?|inr)?\s*([\d,]+)/i);
  const budget = budgetMatch && budgetMatch[1] ? `₹${budgetMatch[1]}` : '₹10,000';

  const missionId = `mission-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  return {
    planId: missionId,
    sessionId,
    summary: `Plan a ${days} ${destination} trip under ${budget}`,
    isMultiAgent: true,
    tasks: [
      {
        taskId: `${missionId}-accom`,
        agentType: 'research',
        description: `Research budget accommodation, hostels, and hotels in ${destination} under ${budget} total trip budget. Find verified property names, rates per night in INR, locations, amenities, and source links.`,
        dependencies: [],
        metadata: { role: 'Accommodation Specialist', destination, budget },
      },
      {
        taskId: `${missionId}-transport`,
        agentType: 'research',
        description: `Research transport options to and within ${destination}. Find intercity transit fares (train/bus), local intra-city transit (auto-rickshaw, e-rickshaw, metro), average rates, and source links.`,
        dependencies: [],
        metadata: { role: 'Transport Specialist', destination, budget },
      },
      {
        taskId: `${missionId}-attractions`,
        agentType: 'research',
        description: `Research top attractions and sightseeing for ${days} in ${destination} (monuments, forts, palaces, heritage spots). Find verified entry ticket prices, composite ticket options, timings, and source links.`,
        dependencies: [],
        metadata: { role: 'Attractions Specialist', destination, budget },
      },
      {
        taskId: `${missionId}-budget`,
        agentType: 'analysis',
        description: `Perform comprehensive budget analysis aggregating accommodation, transport, sightseeing tickets, and food buffer. Validate total estimated cost strictly against the ${budget} limit, compute remaining buffer, and document all explicit assumptions.`,
        dependencies: [`${missionId}-accom`, `${missionId}-transport`, `${missionId}-attractions`],
        metadata: { role: 'Budget & Feasibility Analyst', targetBudget: budget },
      },
      {
        taskId: `${missionId}-chief-planner`,
        agentType: 'synthesis',
        description: `Chief Planner compile final verified ${days} ${destination} itinerary with day-by-day morning/afternoon/evening schedule, master cost breakdown table, specialist agent attributions, clickable sources, and consequential booking notices.`,
        dependencies: [`${missionId}-budget`],
        metadata: { role: 'Chief Planner Synthesis' },
      },
    ],
  };
}

function buildProductComparisonPlan(prompt: string, sessionId: string): OrchestratorPlan {
  const missionId = `mission-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    planId: missionId,
    sessionId,
    summary: `Product research and comparison: ${prompt.slice(0, 60)}`,
    isMultiAgent: true,
    tasks: [
      {
        taskId: `${missionId}-specs`,
        agentType: 'research',
        description: `Research verified top product options, specifications, models, and real source links for: "${prompt}".`,
        dependencies: [],
        metadata: { role: 'Product Research Specialist' },
      },
      {
        taskId: `${missionId}-prices`,
        agentType: 'research',
        description: `Research live pricing in INR, deals, seller ratings, and verified merchant links for: "${prompt}".`,
        dependencies: [],
        metadata: { role: 'Pricing & Deals Specialist' },
      },
      {
        taskId: `${missionId}-analysis`,
        agentType: 'analysis',
        description: `Compare specifications, performance benchmarks, and price-to-value ratios across the researched options.`,
        dependencies: [`${missionId}-specs`, `${missionId}-prices`],
        metadata: { role: 'Value & Review Analyst' },
      },
      {
        taskId: `${missionId}-chief-planner`,
        agentType: 'synthesis',
        description: `Chief Planner compile final product recommendation ranking, verified specs table, exact prices in INR, source links, and purchase advice.`,
        dependencies: [`${missionId}-analysis`],
        metadata: { role: 'Chief Planner' },
      },
    ],
  };
}

function buildFallbackPlan(prompt: string, sessionId: string): OrchestratorPlan {
  const p = prompt.toLowerCase();
  const missionId = `mission-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const tasks: OrchestratorPlan['tasks'] = [];

  if (p.includes('trip') || p.includes('travel') || p.includes('itinerary') || p.includes('jaipur')) {
    return buildTripMissionPlan(prompt, sessionId);
  }

  if (p.includes('code') && (p.includes('research') || p.includes('issue'))) {
    tasks.push({
      taskId: `${missionId}-task-1`,
      agentType: 'research',
      description: `Research relevant background and issue details for: ${prompt}`,
      dependencies: [],
    });
    tasks.push({
      taskId: `${missionId}-task-2`,
      agentType: 'coding',
      description: `Inspect project code files and propose implementation for: ${prompt}`,
      dependencies: [],
    });
    tasks.push({
      taskId: `${missionId}-task-3`,
      agentType: 'synthesis',
      description: `Synthesize research and code analysis into comprehensive answer for: ${prompt}`,
      dependencies: [`${missionId}-task-1`, `${missionId}-task-2`],
    });
  } else if (p.includes('compare') || p.includes('laptop') || p.includes('best')) {
    tasks.push({
      taskId: `${missionId}-task-1`,
      agentType: 'research',
      description: `Gather candidate specifications, prices, and sources for: ${prompt}`,
      dependencies: [],
    });
    tasks.push({
      taskId: `${missionId}-task-2`,
      agentType: 'analysis',
      description: `Compare prices, value, user reviews, and verify constraints for: ${prompt}`,
      dependencies: [`${missionId}-task-1`],
    });
    tasks.push({
      taskId: `${missionId}-task-3`,
      agentType: 'synthesis',
      description: `Synthesize candidate comparison and final recommendation for: ${prompt}`,
      dependencies: [`${missionId}-task-1`, `${missionId}-task-2`],
    });
  } else {
    tasks.push({
      taskId: `${missionId}-task-1`,
      agentType: 'research',
      description: `Conduct primary research for: ${prompt}`,
      dependencies: [],
    });
    tasks.push({
      taskId: `${missionId}-task-2`,
      agentType: 'analysis',
      description: `Analyze data, verify constraints, and evaluate facts for: ${prompt}`,
      dependencies: [`${missionId}-task-1`],
    });
    tasks.push({
      taskId: `${missionId}-task-3`,
      agentType: 'synthesis',
      description: `Synthesize results and present verified answer for: ${prompt}`,
      dependencies: [`${missionId}-task-2`],
    });
  }

  return {
    planId: missionId,
    sessionId,
    summary: 'Automated multi-agent execution plan',
    isMultiAgent: true,
    tasks,
  };
}
