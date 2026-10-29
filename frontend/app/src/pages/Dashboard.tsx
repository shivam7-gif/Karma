import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { SideNav } from '../components/SideNav';
import { Greeting } from '../components/Greeting';
import { PromptBox } from '../components/PromptBox';
import { SuggestionChips } from '../components/SuggestionChips';
import { RecentSection } from '../components/RecentSection';
import { ListPanel } from '../components/ListPanel';
import { TracePanel } from '../components/TracePanel';
import { ChatView } from '../components/ChatView';
import VoicePanel from '../components/chat-ai/VoicePanel';
import { SettingsModal } from '../components/SettingsModal';
import { WebsiteActivityOverlay } from '../components/WebsiteActivityOverlay';
import { IdeWorkspaceView } from '../components/ide/IdeWorkspaceView';
import { useAppStore } from '../store/appStore';
import { useChatStream } from '../hooks/useChatStream';

export const Dashboard: React.FC = () => {
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
        background: view === 'chat' ? '#FFFFFF' : '#FAF8F5',
        backgroundImage:
          view === 'chat'
            ? 'none'
            : "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.035'/%3E%3C/svg%3E\")",
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
          overflowX: 'hidden',
          overflowY: 'auto',
          background: 'transparent',
          padding:
            view === 'ide'
              ? '0 0 0 84px'
              : view === 'chat'
              ? '0 24px 16px 88px'
              : '0 24px 48px 24px',
        }}
      >
        {view === 'ide' ? (
          <IdeWorkspaceView />
        ) : view === 'home' ? (
          /* Home Screen: Vertically Centered Greeting + Prompt + Suggestion Grid + Pick Up Section */
          <div
            className="home-center-hero"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              maxWidth: '720px',
              margin: 'auto auto',
              paddingTop: '20px',
              paddingBottom: '40px',
              position: 'relative',
              animation: 'fadeIn 0.25s ease-out',
            }}
          >
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
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

              {/* Quiet Below-the-fold "Pick up where you left off" Section */}
              <RecentSection />
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

      {/* Global Voice Agent Modal */}
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
            transform: translateY(4px);
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
          }
          main {
            padding: 0 16px 88px 16px !important;
          }
          .home-center-hero {
            margin: 16px auto !important;
            padding-bottom: 24px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;