import { create } from 'zustand';
import type { DeviceMode, Message, TraceItem, AgentLifecycleStatus } from '../api/types';

export type NavItem = 'home' | 'history' | 'ideas' | 'calendar' | 'lists' | 'tasks' | 'insights' | 'ide';

export interface UserProfile {
  name: string;
  email?: string;
  avatar?: string;
  provider?: string;
}

const getInitialUser = (): UserProfile => {
  try {
    const saved = localStorage.getItem('karma_user');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    // ignore
  }
  return { name: 'Shiva', email: 'shiva@example.com' };
};

export interface ActiveWebsiteActivity {
  agentRole?: string | undefined;
  websiteName?: string | undefined;
  domain: string;
  url: string;
  action: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  faviconUrl?: string | undefined;
  screenshotUrl?: string | undefined;
  timestamp: string;
  productTitle?: string | undefined;
  productPrice?: string | undefined;
  budgetINR?: number | undefined;
}

interface AppState {
  user: UserProfile | null;
  view: 'home' | 'chat' | 'ide';
  panelOpen: boolean;
  tracePanelOpen: boolean;
  deviceMode: DeviceMode;
  activeNav: NavItem;
  inputValue: string;
  messages: Message[];
  traceItems: TraceItem[];
  orchestratorTasks: import('../api/types').ClientOrchestratorTask[];
  activeWebsiteActivity: ActiveWebsiteActivity | null;
  isStreaming: boolean;
  streamError: string | null;
  sessionId: string;
  agentLifecycle: { status: AgentLifecycleStatus; message: string; tool?: string; timestamp?: string } | null;

  isVoiceModalOpen: boolean;
  isSettingsOpen: boolean;
  appBuilderProvider: 'auto' | 'manus' | 'replit';

  // Actions
  setAppBuilderProvider: (provider: 'auto' | 'manus' | 'replit') => void;
  setActiveWebsiteActivity: (activity: ActiveWebsiteActivity | null | ((prev: ActiveWebsiteActivity | null) => ActiveWebsiteActivity | null)) => void;
  setAgentLifecycle: (lifecycle: { status: AgentLifecycleStatus; message: string; tool?: string; timestamp?: string } | null) => void;
  upsertOrchestratorTask: (task: Partial<import('../api/types').ClientOrchestratorTask> & { taskId: string }) => void;
  clearOrchestratorTasks: () => void;
  cancelOrchestratorTask: (taskId: string) => Promise<void>;
  cancelAllOrchestratorTasks: () => Promise<void>;
  openVoiceModal: () => void;
  closeVoiceModal: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  setUser: (user: UserProfile | null) => void;
  setView: (view: 'home' | 'chat' | 'ide') => void;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
  setTracePanelOpen: (open: boolean) => void;
  toggleTracePanel: () => void;
  setDeviceMode: (mode: DeviceMode) => void;
  setActiveNav: (nav: NavItem) => void;
  setInputValue: (val: string) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  setStreamError: (err: string | null) => void;
  
  addMessage: (message: Message) => void;
  appendAssistantToken: (messageId: string, token: string) => void;
  setAssistantElicitation: (messageId: string, elicitation: Message['elicitation']) => void;
  answerElicitation: (messageId: string, answer: string) => void;
  
  addTraceItem: (item: TraceItem) => void;
  updateTraceItem: (id: string, patch: Partial<TraceItem>) => void;
  clearTrace: () => void;
  resetToHome: () => void;
}


export const useAppStore = create<AppState>((set) => ({
  user: getInitialUser(),
  view: 'home',
  panelOpen: false,
  tracePanelOpen: false,
  deviceMode: 'screen', // default Echo Show (screen)
  activeNav: 'home',
  inputValue: '',
  messages: [],
  traceItems: [],
  orchestratorTasks: [],
  activeWebsiteActivity: null,
  isStreaming: false,
  streamError: null,
  sessionId: `session_${Date.now()}`,
  agentLifecycle: null,
  isVoiceModalOpen: false,
  isSettingsOpen: false,
  appBuilderProvider: 'auto',

  setAppBuilderProvider: (appBuilderProvider) => set({ appBuilderProvider }),
  setActiveWebsiteActivity: (param) =>
    set((state) => ({
      activeWebsiteActivity: typeof param === 'function' ? param(state.activeWebsiteActivity) : param,
    })),
  setAgentLifecycle: (agentLifecycle) => set({ agentLifecycle }),
  upsertOrchestratorTask: (taskPatch) =>
    set((state) => {
      const idx = state.orchestratorTasks.findIndex((t) => t.taskId === taskPatch.taskId);
      if (idx >= 0) {
        const copy = [...state.orchestratorTasks];
        const existing = copy[idx]!;
        copy[idx] = {
          ...existing,
          ...taskPatch,
          metadata: {
            ...(existing.metadata || {}),
            ...(taskPatch.metadata || {}),
          },
        } as import('../api/types').ClientOrchestratorTask;
        return { orchestratorTasks: copy };
      }
      return {
        orchestratorTasks: [...state.orchestratorTasks, taskPatch as import('../api/types').ClientOrchestratorTask],
      };
    }),
  clearOrchestratorTasks: () => set({ orchestratorTasks: [] }),
  cancelOrchestratorTask: async (taskId: string) => {
    try {
      await fetch('/api/chat/tasks/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      set((state) => ({
        orchestratorTasks: state.orchestratorTasks.map((t) =>
          t.taskId === taskId ? { ...t, status: 'cancelled' } : t
        ),
      }));
    } catch (err) {
      console.warn('Failed to cancel task:', err);
    }
  },
  cancelAllOrchestratorTasks: async () => {
    try {
      const state = useAppStore.getState();
      await fetch('/api/chat/tasks/cancel-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: state.sessionId }),
      });
      set((state) => ({
        orchestratorTasks: state.orchestratorTasks.map((t) =>
          t.status === 'running' || t.status === 'queued' ? { ...t, status: 'cancelled' } : t
        ),
      }));
    } catch (err) {
      console.warn('Failed to cancel all tasks:', err);
    }
  },

  openVoiceModal: () => set({ isVoiceModalOpen: true }),
  closeVoiceModal: () => set({ isVoiceModalOpen: false }),
  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),
  setUser: (user) => {
    if (user) {
      localStorage.setItem('karma_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('karma_user');
    }
    set({ user });
  },
  setView: (view) => set({ view }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  togglePanel: () => set((state) => ({ panelOpen: !state.panelOpen })),
  setTracePanelOpen: (tracePanelOpen) => set({ tracePanelOpen }),
  toggleTracePanel: () => set((state) => ({ tracePanelOpen: !state.tracePanelOpen })),
  setDeviceMode: (deviceMode) => set({ deviceMode }),
  setActiveNav: (activeNav) => set({ activeNav }),
  setInputValue: (inputValue) => set({ inputValue }),
  setIsStreaming: (isStreaming) => set({ isStreaming }),
  setStreamError: (streamError) => set({ streamError }),

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),

  appendAssistantToken: (messageId, token) => set((state) => ({
    messages: state.messages.map((msg) =>
      msg.id === messageId ? { ...msg, text: msg.text + token } : msg
    )
  })),

  setAssistantElicitation: (messageId, elicitation) => set((state) => ({
    messages: state.messages.map((msg) =>
      msg.id === messageId ? { ...msg, elicitation } : msg
    )
  })),

  answerElicitation: (messageId, answer) => set((state) => ({
    messages: state.messages.map((msg) =>
      msg.id === messageId && msg.elicitation
        ? { ...msg, elicitation: { ...msg.elicitation, answered: answer } }
        : msg
    )
  })),

  addTraceItem: (item) => set((state) => ({
    traceItems: [item, ...state.traceItems]
  })),

  updateTraceItem: (id, patch) => set((state) => ({
    traceItems: state.traceItems.map((item) =>
      item.id === id ? { ...item, ...patch } : item
    )
  })),

  clearTrace: () => set({ traceItems: [] }),

  resetToHome: () => set({
    view: 'home',
    messages: [],
    inputValue: '',
    panelOpen: false,
  }),
}));
