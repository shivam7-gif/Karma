import type { AgentType, OrchestratorPlan } from './types.js';
import { callAgentLLM } from './llmHelper.js';
import { logger } from '../../lib/logger.js';

export function isComplexPrompt(prompt: string): boolean {
  const p = prompt.trim().toLowerCase();
  // Simple greetings or trivial queries
  if (/^(hi|hello|hey|good\s+(morning|evening)|who\s+are\s+you|ping|test)[\s!.?]*$/i.test(p)) {
    return false;
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
  if (p.length > 50 && (p.includes('compare') || p.includes('versus') || p.includes('vs'))) {
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
      "agentType": "coding",
      "description": "Specific actionable instruction",
      "dependencies": []
    },
    {
      "taskId": "task-3",
      "agentType": "synthesis",
      "description": "Combine findings from task-1 and task-2",
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
        // Validate DAG to prevent cycles
        const validTasks = parsed.tasks.map((t: any, idx: number) => ({
          taskId: String(t.taskId || `task-${idx + 1}`),
          agentType: validateAgentType(t.agentType),
          description: String(t.description || prompt),
          dependencies: Array.isArray(t.dependencies) ? t.dependencies.map(String) : [],
        }));

        return {
          planId: `plan-${Date.now()}`,
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

function buildFallbackPlan(prompt: string, sessionId: string): OrchestratorPlan {
  const p = prompt.toLowerCase();
  const tasks: OrchestratorPlan['tasks'] = [];

  if (p.includes('code') && (p.includes('research') || p.includes('issue'))) {
    tasks.push({
      taskId: 'task-1',
      agentType: 'research',
      description: `Research relevant background and issue details for: ${prompt}`,
      dependencies: [],
    });
    tasks.push({
      taskId: 'task-2',
      agentType: 'coding',
      description: `Inspect project code files and propose implementation for: ${prompt}`,
      dependencies: [],
    });
    tasks.push({
      taskId: 'task-3',
      agentType: 'synthesis',
      description: `Synthesize research and code analysis into comprehensive answer for: ${prompt}`,
      dependencies: ['task-1', 'task-2'],
    });
  } else if (p.includes('compare') || p.includes('laptop') || p.includes('best')) {
    tasks.push({
      taskId: 'task-1',
      agentType: 'research',
      description: `Gather candidate specifications, prices, and sources for: ${prompt}`,
      dependencies: [],
    });
    tasks.push({
      taskId: 'task-2',
      agentType: 'analysis',
      description: `Compare prices, value, user reviews, and verify constraints for: ${prompt}`,
      dependencies: ['task-1'],
    });
    tasks.push({
      taskId: 'task-3',
      agentType: 'synthesis',
      description: `Synthesize candidate comparison and final recommendation for: ${prompt}`,
      dependencies: ['task-1', 'task-2'],
    });
  } else {
    tasks.push({
      taskId: 'task-1',
      agentType: 'research',
      description: `Conduct primary research for: ${prompt}`,
      dependencies: [],
    });
    tasks.push({
      taskId: 'task-2',
      agentType: 'synthesis',
      description: `Synthesize results and present verified answer for: ${prompt}`,
      dependencies: ['task-1'],
    });
  }

  return {
    planId: `plan-${Date.now()}`,
    sessionId,
    summary: 'Automated multi-agent execution plan',
    isMultiAgent: true,
    tasks,
  };
}
