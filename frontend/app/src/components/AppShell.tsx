import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { TopBar } from './TopBar';
import { SideNav } from './SideNav';
import { Greeting } from './Greeting';
import { PromptBox } from './PromptBox';
import { SuggestionChips } from './SuggestionChips';
import { ListPanel } from './ListPanel';
import { TracePanel } from './TracePanel';
import { ChatView } from './ChatView';
import VoicePanel from './chat-ai/VoicePanel';
import SoftAurora from './chat-ai/SoftAurora';
import { SettingsModal } from './SettingsModal';
import { WebsiteActivityOverlay } from './WebsiteActivityOverlay';
import { IdeWorkspaceView } from './ide/IdeWorkspaceView';
import { useAppStore } from '../store/appStore';
import { useChatStream } from '../hooks/useChatStream';

export const AppShell: React.FC = () => {
  const location = useLocation();
  const {
    view,
    setView,
    setActiveNav,
    panelOpen,
    setPanelOpen,
    inputValue,
    setInputValue,
    isStreaming,
    answerElicitation,
    isVoiceModalOpen,
    closeVoiceModal,
    isSettingsOpen,
    closeSettings,
    messages,
  } = useAppStore();

  useEffect(() => {
    if (location.pathname === '/ide' || location.search.includes('view=ide')) {
      setView('ide');
      setActiveNav('ide');
    }
  }, [location.pathname, location.search, setView, setActiveNav]);

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
        width: '100vw',
        height: '100vh',
        maxWidth: 'none',
        maxHeight: 'none',
        borderRadius: 0,
        position: 'relative',
        background: view === 'chat' ? '#FFFFFF' : 'var(--bg-app, #faf8f5)',
        boxShadow: 'none',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: 'none',
      }}
    >
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
          background: view === 'chat' ? '#FFFFFF' : 'transparent',
          padding: view === 'ide' ? '0 0 0 84px' : view === 'chat' ? '0 24px 16px 88px' : '0 32px 24px 32px',
        }}
      >
        {view === 'ide' ? (
          <IdeWorkspaceView />
        ) : view === 'home' ? (
          /* Home Screen: Vertically Centered Greeting + Prompt + Chips with SoftAurora ambient background */
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
              position: 'relative',
              animation: 'fadeIn 0.3s ease-out',
            }}
          >
            {/* Ambient SoftAurora background behind greeting (low opacity, lightMode) */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -55%)',
                width: '680px',
                height: '380px',
                borderRadius: '50%',
                overflow: 'hidden',
                pointerEvents: 'none',
                zIndex: 0,
                filter: 'blur(10px)',
              }}
            >
              <SoftAurora
                speed={0.25}
                scale={1.6}
                brightness={0.8}
                opacity={0.3}
                lightMode={true}
                color1="#f5f2ec"
                color2="#8b3dff"
                intro={false}
                enableMouseInteraction={false}
              />
            </div>

            <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Greeting />

              <PromptBox
                value={inputValue}
                onChange={setInputValue}
                onSubmit={onSubmitPrompt}
                disabled={isStreaming}
              />

              <SuggestionChips onSelectPrompt={onSelectChip} />
            </div>
          </div>
        ) : (
          /* Conversation Mode: Dashboard Natural Chat Section */
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

      {/* Global Voice Agent Modal (Aurora Orb with SoftAurora) */}
      <VoicePanel
        isOpen={isVoiceModalOpen}
        onClose={closeVoiceModal}
        onSendMessage={async (spokenText) => {
          handleSendMessage(spokenText);
        }}
        latestAssistantReply={[...messages].reverse().find((m) => m.sender === 'assistant')?.text}
      />

      {/* AI Engine & OpenRouter BYOK Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={closeSettings}
      />

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

      {/* Live Website Overlay for MCP and Browser Activity */}
      <WebsiteActivityOverlay />

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
