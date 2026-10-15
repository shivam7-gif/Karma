import React from 'react';
import { TopBar } from './TopBar';
import { SideNav } from './SideNav';
import { Greeting } from './Greeting';
import { PromptBox } from './PromptBox';
import { SuggestionChips } from './SuggestionChips';
import { ListPanel } from './ListPanel';
import { ChatView } from './ChatView';
import { TracePanel } from './TracePanel';
import { useAppStore } from '../store/appStore';
import { useChatStream } from '../hooks/useChatStream';

export const AppShell: React.FC = () => {
  const {
    view,
    panelOpen,
    setPanelOpen,
    inputValue,
    setInputValue,
    isStreaming,
    answerElicitation,
  } = useAppStore();

  const { handleSendMessage } = useChatStream();

  const onSubmitPrompt = (text: string) => {
    handleSendMessage(text);
    setInputValue('');
  };

  const onSelectChip = (promptText: string) => {
    setInputValue(promptText);
  };

  const handleSelectElicitationOption = (messageId: string, option: string) => {
    answerElicitation(messageId, option);
    handleSendMessage(option);
  };

  return (
    <div
      className="echo-sim-outer-frame"
      style={{
        width: '100%',
        maxWidth: '1440px',
        height: 'calc(100vh - 24px)',
        maxHeight: '940px',
        borderRadius: 'var(--radius-outer)',
        position: 'relative',
        background: 'var(--bg-app-gradient)',
        boxShadow: 'var(--shadow-app)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid var(--border-glass)',
      }}
    >
      {/* Ambient center blue glow behind content */}
      <div
        className="ambient-glow-sphere"
        style={{
          position: 'absolute',
          top: '45%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '640px',
          height: '420px',
          background: 'radial-gradient(ellipse, rgba(76, 141, 255, 0.16) 0%, rgba(15, 42, 74, 0.08) 45%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Top Bar */}
      <TopBar />

      {/* Left Floating Nav Pill */}
      <SideNav />

      {/* Main Content Area */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 10,
          overflow: 'hidden',
          padding: '0 32px 24px 32px',
        }}
      >
        {view === 'home' ? (
          /* Home Screen: Vertically Centered Greeting + Prompt + Chips */
          <div
            className="home-center-hero"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              maxWidth: '680px',
              margin: '0 auto',
              paddingBottom: '40px',
              animation: 'fadeIn 0.3s ease-out',
            }}
          >
            <Greeting />

            <PromptBox
              value={inputValue}
              onChange={setInputValue}
              onSubmit={onSubmitPrompt}
              disabled={isStreaming}
            />

            <SuggestionChips onSelectPrompt={onSelectChip} />
          </div>
        ) : (
          /* Conversation Mode: Chat Transcript with Bottom Docked Input */
          <div
            className="conversation-container"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              height: '100%',
              overflow: 'hidden',
              animation: 'fadeIn 0.25s ease-out',
            }}
          >
            <ChatView onSelectElicitationOption={handleSelectElicitationOption} />

            {/* Docked bottom prompt box */}
            <div
              style={{
                width: '100%',
                paddingTop: '8px',
                paddingBottom: '8px',
              }}
            >
              <PromptBox
                value={inputValue}
                onChange={setInputValue}
                onSubmit={onSubmitPrompt}
                disabled={isStreaming}
                isDocked={true}
              />
            </div>
          </div>
        )}
      </main>

      {/* Slide-over Lists Panel */}
      <ListPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        onSelectList={(listTitle) => {
          handleSendMessage(`Show items in ${listTitle}`);
        }}
      />

      {/* Bottom Collapsible Trace Panel Console */}
      <TracePanel />

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 768px) {
          .echo-sim-outer-frame {
            height: 100vh !important;
            max-height: 100vh !important;
            border-radius: 0 !important;
            border: none !important;
          }
          main {
            padding: 0 16px 80px 16px !important;
          }
        }
      `}</style>
    </div>
  );
};
