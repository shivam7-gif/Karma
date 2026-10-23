import { useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { sendMessage } from '../api/client';
import type { StreamEvent, Message } from '../api/types';
import { useSpeech } from './useSpeech';

export function useChatStream() {
  const {
    sessionId,
    deviceMode,
    addMessage,
    appendAssistantToken,
    setAssistantElicitation,
    addTraceItem,
    updateTraceItem,
    setView,
    setIsStreaming,
    setStreamError,
    setAgentLifecycle,
    isStreaming,
    upsertOrchestratorTask,
    clearOrchestratorTasks,
    setActiveWebsiteActivity,
  } = useAppStore();

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSeqRef = useRef<number>(-1);
  const activeSessionIdRef = useRef<string>(sessionId);
  activeSessionIdRef.current = sessionId;
  const isStreamingRef = useRef<boolean>(isStreaming);
  isStreamingRef.current = isStreaming;

  const { speak } = useSpeech();

  const stopStream = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setAgentLifecycle({
      status: 'stopped',
      message: 'Automation stopped by user (Escape / Stop).',
    });

    // Propagate cancellation to backend to kill active tools / Playwright / overlay
    try {
      let userId = 'default-user';
      try {
        const saved = localStorage.getItem('karma_user');
        if (saved) {
          const u = JSON.parse(saved);
          if (u.email || u.id) userId = u.email || u.id;
        }
      } catch {}

      await fetch('/api/chat/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ conversationId: activeSessionIdRef.current }),
      });
    } catch (e) {
      console.warn('Failed to send stop signal to backend:', e);
    }
  }, [setIsStreaming, setAgentLifecycle]);

  // Global Escape key listener to stop active agent session
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isStreamingRef.current) {
        e.preventDefault();
        stopStream();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [stopStream]);

  // Abort ongoing stream on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const handleSendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      // Switch view from home to chat
      setView('chat');
      setIsStreaming(true);
      setStreamError(null);
      clearOrchestratorTasks();
      setActiveWebsiteActivity(null);
      setAgentLifecycle({
        status: 'planning',
        message: 'Planning your request...',
      });

      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // 1. Add user message
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: trimmed,
        timestamp,
      };
      addMessage(userMessage);

      // 2. Prepare assistant placeholder
      const assistantId = `assistant-${Date.now()}`;
      const assistantMessage: Message = {
        id: assistantId,
        sender: 'assistant',
        text: '',
        timestamp,
      };
      addMessage(assistantMessage);

      let accumulatedAssistantText = '';
      lastSeqRef.current = -1;

      // Cancel previous stream if any
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        await sendMessage(
          trimmed,
          sessionId,
          (event: StreamEvent) => {
            // Sequence check for idempotent apply
            if (typeof event.seq === 'number') {
              if (event.seq <= lastSeqRef.current) {
                return; // Discard duplicate or out-of-order event
              }
              lastSeqRef.current = event.seq;
            }

            const timeStr = new Date().toLocaleTimeString();

            switch (event.type) {
              case 'lifecycle': {
                setAgentLifecycle({
                  status: event.status,
                  message: event.message,
                  tool: event.tool,
                  timestamp: event.timestamp,
                });

                if (event.status === 'controlling_screen' || event.status === 'executing_tool') {
                  addTraceItem({
                    id: `lifecycle-${Date.now()}`,
                    timestamp: timeStr,
                    name: event.tool || event.status,
                    args: (event.metadata as Record<string, unknown>) || {},
                    status: 'running',
                  });
                }
                break;
              }

              case 'task_created': {
                upsertOrchestratorTask(event.task);
                break;
              }

              case 'task_updated': {
                upsertOrchestratorTask({
                  taskId: event.taskId,
                  sessionId: event.sessionId,
                  agentType: event.agentType,
                  status: event.status,
                  activity: event.activity,
                  startedAt: event.startedAt,
                  completedAt: event.completedAt,
                  result: event.result,
                  error: event.error,
                  metadata: event.metadata,
                });

                if (
                  event.metadata?.visitedWebsites &&
                  Array.isArray(event.metadata.visitedWebsites) &&
                  event.metadata.visitedWebsites.length > 0
                ) {
                  const latestSite = event.metadata.visitedWebsites[event.metadata.visitedWebsites.length - 1];
                  if (latestSite && latestSite.url) {
                    setActiveWebsiteActivity({
                      agentRole: event.metadata.role || latestSite.agentRole || event.agentType,
                      websiteName: latestSite.title || latestSite.domain,
                      domain: latestSite.domain,
                      url: latestSite.url,
                      action: event.activity || `Inspecting ${latestSite.domain}`,
                      status: event.status === 'completed' ? 'completed' : event.status === 'failed' ? 'failed' : 'running',
                      faviconUrl: latestSite.faviconUrl || `https://www.google.com/s2/favicons?domain=${latestSite.domain}&sz=32`,
                      timestamp: event.timestamp,
                    });
                  }
                }
                break;
              }

              case 'task_completed': {
                upsertOrchestratorTask({
                  taskId: event.taskId,
                  sessionId: event.sessionId,
                  agentType: event.agentType,
                  status: 'completed',
                  result: event.result,
                  metadata: event.metadata,
                });
                break;
              }

              case 'progress': {
                setAgentLifecycle({
                  status: event.status as any,
                  message: event.message,
                  timestamp: event.timestamp,
                });

                if (event.data && typeof event.data === 'object') {
                  const pData = event.data as Record<string, unknown>;
                  if (pData.url || pData.domain) {
                    const rawUrl = String(pData.url || '');
                    let domain = String(pData.domain || '');
                    if (!domain && rawUrl) {
                      try {
                        domain = new URL(rawUrl).hostname.replace(/^www\./, '');
                      } catch {
                        domain = 'web';
                      }
                    }
                    const prodTitle = pData.title ? String(pData.title) : (pData.product as any)?.title ? String((pData.product as any).title) : undefined;
                    const prodPrice = pData.price ? String(pData.price) : (pData.product as any)?.price ? String((pData.product as any).price) : undefined;
                    const budgetVal = typeof pData.budgetINR === 'number' ? pData.budgetINR : undefined;

                    setActiveWebsiteActivity({
                      agentRole: String(pData.agentRole || 'Browser Automation'),
                      websiteName: String(pData.siteName || domain),
                      domain,
                      url: rawUrl,
                      action: event.message || 'Interacting with website',
                      status: event.status === 'completed' ? 'completed' : event.status === 'error' ? 'failed' : 'running',
                      screenshotUrl: pData.screenshot ? String(pData.screenshot) : undefined,
                      faviconUrl: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
                      timestamp: event.timestamp || new Date().toISOString(),
                      productTitle: prodTitle,
                      productPrice: prodPrice,
                      budgetINR: budgetVal,
                    });
                  }
                }
                break;
              }

              case 'token':
              case 'delta': {
                const tokenText = (event as any).text || '';
                accumulatedAssistantText += tokenText;
                appendAssistantToken(assistantId, tokenText);
                break;
              }

              case 'tool_call':
                addTraceItem({
                  id: event.id,
                  timestamp: timeStr,
                  name: event.name,
                  args: event.args,
                  status: 'running',
                });
                break;

              case 'tool_result':
                updateTraceItem(event.id, {
                  result: event.result,
                  ms: event.ms,
                  status: 'completed',
                });
                break;

              case 'elicitation':
                setAssistantElicitation(assistantId, {
                  id: event.id,
                  question: event.question,
                  options: event.options,
                });
                break;

              case 'done':
                setIsStreaming(false);
                setActiveWebsiteActivity((prev) => (prev ? { ...prev, status: 'completed' } : null));
                setAgentLifecycle({
                  status: 'completed',
                  message: 'Completed.',
                });
                // If voice mode or voice-only device mode is active, read the assistant message aloud
                if (deviceMode === 'voice-only' && accumulatedAssistantText) {
                  speak(accumulatedAssistantText);
                }
                break;

              case 'error':
                setStreamError(event.error || 'An error occurred while streaming.');
                setAgentLifecycle({
                  status: 'error',
                  message: event.error || 'Execution error',
                });
                setIsStreaming(false);
                break;
            }
          },
          abortControllerRef.current.signal
        );
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          console.log('Stream cancelled');
          setAgentLifecycle({
            status: 'stopped',
            message: 'Automation stopped by user.',
          });
        } else {
          console.error('Chat stream error:', err);
          setStreamError('Could not reach Karma assistant. Please check your connection or retry.');
          setAgentLifecycle({
            status: 'error',
            message: 'Connection failed',
          });
        }
      } finally {
        setIsStreaming(false);
      }
    },
    [
      sessionId,
      deviceMode,
      addMessage,
      appendAssistantToken,
      setAssistantElicitation,
      addTraceItem,
      updateTraceItem,
      setView,
      setIsStreaming,
      setStreamError,
      setAgentLifecycle,
      speak,
    ]
  );

  return {
    handleSendMessage,
    stopStream,
  };
}
