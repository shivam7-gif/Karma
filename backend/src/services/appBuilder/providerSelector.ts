import type { AppBuilderProvider, AppBuilderProviderId } from './types.js';
import { manusAdapter } from './manusAdapter.js';
import { replitAdapter } from './replitAdapter.js';

export interface SelectionResult {
  provider: AppBuilderProvider;
  reason: string;
  fallbackAvailable: boolean;
  fallbackProvider?: AppBuilderProvider | undefined;
}

export class SmartProviderSelector {
  private providers: Map<AppBuilderProviderId, AppBuilderProvider> = new Map<AppBuilderProviderId, AppBuilderProvider>([
    ['manus', manusAdapter as AppBuilderProvider],
    ['replit', replitAdapter as AppBuilderProvider],
  ]);

  /**
   * Evaluates user prompt, explicit overrides, and credentials to select the best builder provider.
   */
  async selectProvider(
    prompt: string,
    override?: AppBuilderProviderId | string
  ): Promise<SelectionResult> {
    const normOverride = (override || '').toLowerCase().trim() as AppBuilderProviderId;

    // Check availability
    const manusAvailability = await manusAdapter.checkAvailability();
    const replitAvailability = await replitAdapter.checkAvailability();

    // 1. Explicit user override: Manus
    if (normOverride === 'manus' || /\b(use manus|via manus|using manus)\b/i.test(prompt)) {
      if (manusAvailability.available) {
        return {
          provider: manusAdapter,
          reason: 'User explicitly requested Manus AI for autonomous app generation.',
          fallbackAvailable: true,
          fallbackProvider: replitAdapter,
        };
      }
      return {
        provider: replitAdapter,
        reason: `Manus AI was requested, but ${manusAvailability.reason || 'MANUS_API_KEY is not configured'}. Safely routed to Replit Agent with full specification handoff.`,
        fallbackAvailable: false,
      };
    }

    // 2. Explicit user override: Replit
    if (normOverride === 'replit' || /\b(use replit|via replit|using replit)\b/i.test(prompt)) {
      return {
        provider: replitAdapter,
        reason: 'User explicitly selected Replit Agent for interactive sandbox creation and hosting.',
        fallbackAvailable: manusAvailability.available,
        fallbackProvider: manusAvailability.available ? manusAdapter : undefined,
      };
    }

    // 3. Auto Selection Layer
    // App Creation & Full-Stack Prototyping:
    // If Manus API key is configured, use Manus for fully autonomous API-driven generation
    if (manusAvailability.available) {
      return {
        provider: manusAdapter,
        reason: 'Selected Manus AI for verified headless API task execution and autonomous multi-file scaffolding.',
        fallbackAvailable: true,
        fallbackProvider: replitAdapter,
      };
    }

    // Otherwise, default to Replit with structured project brief & 1-click template handoff
    return {
      provider: replitAdapter,
      reason: 'Selected Replit Agent: Instant interactive template creation and live web hosting (no Manus API key detected in environment).',
      fallbackAvailable: false,
    };
  }

  getProvider(id: AppBuilderProviderId): AppBuilderProvider | undefined {
    return this.providers.get(id);
  }

  getAllProviders(): AppBuilderProvider[] {
    return Array.from(this.providers.values());
  }
}

export const providerSelector = new SmartProviderSelector();
