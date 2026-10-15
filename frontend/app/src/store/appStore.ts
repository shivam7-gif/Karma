import { create } from 'zustand';
import type { DeviceMode, Message, TraceItem } from '../api/types';

export type NavItem = 'home' | 'history' | 'ideas' | 'calendar' | 'lists' | 'tasks' | 'insights';

interface AppState {
  view: 'home' | 'chat';
  panelOpen: boolean;
  tracePanelOpen: boolean;
  deviceMode: DeviceMode;
  activeNav: NavItem;
  inputValue: string;
  messages: Message[];
  traceItems: TraceItem[];
  isStreaming: boolean;
  sessionId: string;

  // Actions
  setView: (view: 'home' | 'chat') => void;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
  setTracePanelOpen: (open: boolean) => void;
  toggleTracePanel: () => void;
  setDeviceMode: (mode: DeviceMode) => void;
  setActiveNav: (nav: NavItem) => void;
  setInputValue: (val: string) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  
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
  view: 'home',
  panelOpen: false,
  tracePanelOpen: false,
  deviceMode: 'screen', // default Echo Show (screen)
  activeNav: 'home',
  inputValue: '',
  messages: [],
  traceItems: [],
  isStreaming: false,
  sessionId: `session_${Date.now()}`,

  setView: (view) => set({ view }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  togglePanel: () => set((state) => ({ panelOpen: !state.panelOpen })),
  setTracePanelOpen: (tracePanelOpen) => set({ tracePanelOpen }),
  toggleTracePanel: () => set((state) => ({ tracePanelOpen: !state.tracePanelOpen })),
  setDeviceMode: (deviceMode) => set({ deviceMode }),
  setActiveNav: (activeNav) => set({ activeNav }),
  setInputValue: (inputValue) => set({ inputValue }),
  setIsStreaming: (isStreaming) => set({ isStreaming }),

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
