import { useCallback, useRef } from 'react';
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
  } = useAppStore();

  const abortControllerRef = useRef<AbortController | null>(null);
  const { speak } = useSpeech();

  const handleSendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      // Switch view from home to chat
      setView('chat');
      setIsStreaming(true);

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
            const timeStr = new Date().toLocaleTimeString();

            switch (event.type) {
              case 'token':
                accumulatedAssistantText += event.text;
                appendAssistantToken(assistantId, event.text);
                break;

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
                // If voice mode or voice-only device mode is active, read the assistant message aloud
                if (deviceMode === 'voice-only' && accumulatedAssistantText) {
                  speak(accumulatedAssistantText);
                }
                break;
            }
          },
          abortControllerRef.current.signal
        );
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          console.log('Stream cancelled');
        } else {
          console.error('Chat stream error:', err);
          appendAssistantToken(assistantId, '\n[Sorry, an error occurred while streaming response.]');
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
      speak,
    ]
  );

  return {
    handleSendMessage,
  };
}
