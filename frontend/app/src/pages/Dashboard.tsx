import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { SideNav } from '../components/SideNav';
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
import FitWord from '../components/FitWord';
import { useAppStore } from '../store/appStore';
import { useChatStream } from '../hooks/useChatStream';

/* ------------------------------------------------------------------ */
/*  Karma dashboard, same visual language as the landing page:         */
/*  white paper, one electric-blue ink (#1F44FF), Anton for display    */
/*  type, Archivo for text, 2px rules.                                 */
/*  The tokens below are CSS variables on the .kd root, so any child   */
/*  component can use var(--c), var(--p) and var(--t).                 */
/* ------------------------------------------------------------------ */

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
      className="echo-sim-outer-frame kd"
      style={{
        width: '100vw',
        height: '100vh',
        maxWidth: 'none',
        maxHeight: 'none',
        borderRadius: 0,
        position: 'relative',
        background: '#FFFFFF',
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
              : '0 24px 48px 88px',
        }}
      >
        {view === 'ide' ? (
          <IdeWorkspaceView />
        ) : view === 'home' ? (
          /* Home: giant stretched heading, one bold line, then the prompt */
          <div className="home-center-hero kd-home">
            <div className="kd-meta">
              <span>Voice first</span>
              <svg width="26" height="26" viewBox="0 0 30 30" fill="none" aria-hidden="true">
                <circle cx="15" cy="15" r="12" stroke="currentColor" strokeWidth="3" />
                <circle cx="15" cy="15" r="4" fill="currentColor" />
              </svg>
              <span>Works across your apps</span>
            </div>

            <h1 className="kd-giant kd-wipe">
              <span className="kd-sr">Ask Karma</span>
              <FitWord text="ASK KARMA" height="min(24vh, 12vw)" />
            </h1>

            <p className="kd-statement">Say it once. Karma handles the rest.</p>

            <div className="kd-col">
              <PromptBox
                value={inputValue}
                onChange={setInputValue}
                onSubmit={onSubmitPrompt}
                disabled={isStreaming}
              />

              <SuggestionChips onSelectPrompt={onSelectChip} />

              {/* Quiet below-the-fold "Pick up where you left off" section */}
              <RecentSection />
            </div>
          </div>
        ) : (
          /* Conversation mode */
          <div
            className="conversation-container"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              height: '100%',
              overflow: 'hidden',
              animation: 'kdFadeIn 0.25s ease-out',
            }}
          >
            <ChatView onSelectElicitationOption={handleSelectElicitationOption} />

            {/* Docked bottom prompt box */}
            <div style={{ width: '100%', paddingTop: '8px', paddingBottom: '8px' }}>
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
      <SettingsModal isOpen={isSettingsOpen} onClose={closeSettings} />

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
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;500;600;700&display=swap');

        /* design tokens, usable by every child component */
        .kd { --c:#1F44FF; --p:#FFFFFF; --t:#EEF1FF; --line:#1F44FF;
              color:var(--c); font-family:'Archivo',system-ui,sans-serif; }
        .kd button:focus-visible, .kd a:focus-visible, .kd textarea:focus-visible, .kd input:focus-visible {
          outline:3px solid var(--c); outline-offset:3px; }
        .kd ::selection { background:var(--c); color:#fff; }

        /* home hero */
        .kd-home { display:flex; flex-direction:column; align-items:center; width:100%; max-width:1100px;
                   margin:auto; padding:24px 0 40px; position:relative; animation:kdFadeIn .25s ease-out; }
        .kd-meta { display:flex; align-items:center; gap:16px; font-size:14px; font-weight:600; margin-bottom:18px; }
        .kd-giant { width:100%; margin:0; line-height:1; }
        .kd-statement { margin:22px 0 30px; text-align:center; font-size:clamp(18px,1.8vw,28px); font-weight:700;
                        text-transform:uppercase; letter-spacing:-.01em; line-height:1.1; }
        .kd-col { width:100%; max-width:760px; display:flex; flex-direction:column; align-items:center; }
        .kd-sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }

        /* the one moment: the heading wipes up on load */
        @keyframes kdWipe { from { clip-path:inset(100% 0 0 0); } to { clip-path:inset(0 0 0 0); } }
        .kd-wipe { animation:kdWipe 1s cubic-bezier(.77,0,.18,1) both; }

        @keyframes kdFadeIn {
          from { opacity:0; transform:translateY(4px); }
          to   { opacity:1; transform:translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .kd-wipe, .kd-home { animation:none !important; }
        }

        @media (max-width: 768px) {
          .echo-sim-outer-frame { height:100vh !important; max-height:100vh !important; }
          main { padding:0 16px 88px 16px !important; }
          .home-center-hero { margin:16px auto !important; padding-bottom:24px !important; }
          .kd-meta { font-size:13px; }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;