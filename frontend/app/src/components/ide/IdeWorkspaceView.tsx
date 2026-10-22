import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderOpen,
  Save,
  Play,
  Square,
  Eye,
  GitBranch,
  Terminal as TerminalIcon,
  Sparkles,
} from 'lucide-react';
import { FileExplorer } from './FileExplorer';
import { EditorTabs } from './EditorTabs';
import { CodeEditor } from './CodeEditor';
import { TerminalPanel } from './TerminalPanel';
import { LivePreview } from './LivePreview';
import { GitDiffViewer } from './GitDiffViewer';
import { CodingAgentSidebar } from './CodingAgentSidebar';
import { ideApi } from '../../api/ideApi';
import type { WorkspaceFileNode, EditorTab } from '../../types/ide';

export const IdeWorkspaceView: React.FC = () => {
  const [workspaceRoot, setWorkspaceRoot] = useState('');
  const [tree, setTree] = useState<WorkspaceFileNode[]>([]);
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | undefined>(undefined);
  const [bottomTab, setBottomTab] = useState<'terminal' | 'preview' | 'git'>('terminal');
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [showAgentSidebar, setShowAgentSidebar] = useState(true);
  const [isAppRunning, setIsAppRunning] = useState(false);
  const [appProcessId, setAppProcessId] = useState<string | null>(null);

  // 1. Initial Load of Tree & Root
  const loadWorkspace = useCallback(async () => {
    try {
      const data = await ideApi.getTree();
      setWorkspaceRoot(data.root);
      setTree(data.tree);
    } catch (err) {
      console.error('Failed to load workspace:', err);
    }
  }, []);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  // 2. Open File
  const handleOpenFile = async (node: WorkspaceFileNode) => {
    const existing = tabs.find((t) => t.path === node.relativePath);
    if (existing) {
      setActiveTabPath(existing.path);
      return;
    }

    try {
      const data = await ideApi.readFile(node.relativePath);
      const ext = node.extension || 'txt';
      let lang = 'typescript';
      if (['js', 'jsx'].includes(ext)) lang = 'javascript';
      else if (['json'].includes(ext)) lang = 'json';
      else if (['css'].includes(ext)) lang = 'css';
      else if (['html'].includes(ext)) lang = 'html';
      else if (['md'].includes(ext)) lang = 'markdown';
      else if (['py'].includes(ext)) lang = 'python';

      const newTab: EditorTab = {
        path: data.relativePath,
        name: node.name,
        content: data.content,
        hash: data.hash,
        isDirty: false,
        language: lang,
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabPath(newTab.path);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Could not open file: ${msg}`);
    }
  };

  // 3. Save Active File
  const handleSaveActiveFile = async () => {
    if (!activeTabPath) return;
    const tab = tabs.find((t) => t.path === activeTabPath);
    if (!tab) return;

    try {
      const result = await ideApi.saveFile(tab.path, tab.content, tab.hash);
      setTabs((prev) =>
        prev.map((t) =>
          t.path === tab.path ? { ...t, hash: result.hash, isDirty: false } : t
        )
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Save error: ${msg}`);
    }
  };

  // 4. Update Content in Active Tab
  const handleEditorChange = (newVal: string) => {
    if (!activeTabPath) return;
    setTabs((prev) =>
      prev.map((t) =>
        t.path === activeTabPath ? { ...t, content: newVal, isDirty: true } : t
      )
    );
  };

  // 5. Close Tab
  const handleCloseTab = (path: string) => {
    setTabs((prev) => prev.filter((t) => t.path !== path));
    if (activeTabPath === path) {
      const remaining = tabs.filter((t) => t.path !== path);
      setActiveTabPath(remaining.length > 0 ? remaining[0].path : undefined);
    }
  };

  // 6. Create Entry
  const handleCreateEntry = async (type: 'file' | 'directory', parentPath: string) => {
    const name = prompt(`Enter ${type} name:`);
    if (!name) return;

    const targetPath = parentPath ? `${parentPath}/${name}` : name;
    try {
      await ideApi.createEntry(targetPath, type);
      await loadWorkspace();
      if (type === 'file') {
        await handleOpenFile({
          name,
          path: targetPath,
          relativePath: targetPath,
          type: 'file',
          extension: name.split('.').pop(),
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Could not create entry: ${msg}`);
    }
  };

  // 7. Delete Entry
  const handleDeleteEntry = async (path: string) => {
    try {
      await ideApi.deleteEntry(path);
      handleCloseTab(path);
      await loadWorkspace();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Could not delete: ${msg}`);
    }
  };

  // 8. Run Application
  const handleRunApp = async () => {
    try {
      setIsAppRunning(true);
      setBottomTab('terminal');
      setShowBottomPanel(true);
      const res = await ideApi.runTerminalCommand('npm run dev');
      setAppProcessId(res.processId);
    } catch (err: unknown) {
      setIsAppRunning(false);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Could not start app: ${msg}`);
    }
  };

  const handleStopApp = async () => {
    if (appProcessId) {
      await ideApi.stopProcess(appProcessId);
      setIsAppRunning(false);
      setAppProcessId(null);
    }
  };

  // 9. Change Workspace Root
  const handleChangeRoot = async () => {
    const newRoot = prompt('Enter absolute workspace path on host:', workspaceRoot);
    if (!newRoot || newRoot === workspaceRoot) return;

    try {
      const updated = await ideApi.setRoot(newRoot);
      setWorkspaceRoot(updated);
      setTabs([]);
      setActiveTabPath(undefined);
      await loadWorkspace();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Failed to set workspace: ${msg}`);
    }
  };

  const activeTab = tabs.find((t) => t.path === activeTabPath);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: '#040711',
        color: '#f8fafc',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        overflow: 'hidden',
      }}
    >
      {/* IDE Top Bar */}
      <header
        style={{
          height: '42px',
          background: '#0f172a',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          zIndex: 20,
        }}
      >
        {/* Left: Project Selector & Path */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleChangeRoot}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#38bdf8',
              padding: '4px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <FolderOpen size={14} />
            <span style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {workspaceRoot.split(/[\\/]/).pop() || 'Workspace'}
            </span>
          </button>
        </div>

        {/* Center: Run / Stop & Save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isAppRunning ? (
            <button
              type="button"
              onClick={handleStopApp}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                padding: '4px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              <Square size={12} fill="#fff" /> Stop App
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRunApp}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#10b981',
                color: '#fff',
                border: 'none',
                padding: '4px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              <Play size={12} fill="#fff" /> Run App
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveActiveFile}
            disabled={!activeTab?.isDirty}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: activeTab?.isDirty ? '#38bdf8' : '#1e293b',
              color: activeTab?.isDirty ? '#0f172a' : '#64748b',
              border: 'none',
              padding: '4px 12px',
              borderRadius: '6px',
              cursor: activeTab?.isDirty ? 'pointer' : 'default',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <Save size={13} /> Save (Ctrl+S)
          </button>
        </div>

        {/* Right: Panel Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={() => {
              setShowBottomPanel(true);
              setBottomTab('terminal');
            }}
            title="Terminal"
            style={{
              background: showBottomPanel && bottomTab === 'terminal' ? '#334155' : 'transparent',
              color: showBottomPanel && bottomTab === 'terminal' ? '#38bdf8' : '#94a3b8',
              border: 'none',
              padding: '5px',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            <TerminalIcon size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              setShowBottomPanel(true);
              setBottomTab('preview');
            }}
            title="Live Preview"
            style={{
              background: showBottomPanel && bottomTab === 'preview' ? '#334155' : 'transparent',
              color: showBottomPanel && bottomTab === 'preview' ? '#38bdf8' : '#94a3b8',
              border: 'none',
              padding: '5px',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            <Eye size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              setShowBottomPanel(true);
              setBottomTab('git');
            }}
            title="Git Diff"
            style={{
              background: showBottomPanel && bottomTab === 'git' ? '#334155' : 'transparent',
              color: showBottomPanel && bottomTab === 'git' ? '#38bdf8' : '#94a3b8',
              border: 'none',
              padding: '5px',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            <GitBranch size={16} />
          </button>
          <button
            type="button"
            onClick={() => setShowAgentSidebar(!showAgentSidebar)}
            title="Toggle Coding Engine"
            style={{
              background: showAgentSidebar ? '#334155' : 'transparent',
              color: showAgentSidebar ? '#38bdf8' : '#94a3b8',
              border: 'none',
              padding: '5px',
              borderRadius: '4px',
              cursor: 'pointer',
              marginLeft: '6px',
            }}
          >
            <Sparkles size={16} />
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: File Explorer Tree */}
        <FileExplorer
          tree={tree}
          activeFilePath={activeTabPath}
          onSelectFile={handleOpenFile}
          onCreateEntry={handleCreateEntry}
          onDeleteEntry={handleDeleteEntry}
          onRefresh={loadWorkspace}
        />

        {/* Center: Editor Area & Dockable Bottom Panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Top: Editor Tabs */}
          <EditorTabs
            tabs={tabs}
            activeTabPath={activeTabPath}
            onSelectTab={(p) => setActiveTabPath(p)}
            onCloseTab={handleCloseTab}
          />

          {/* Editor Body */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {activeTab ? (
              <CodeEditor
                value={activeTab.content}
                language={activeTab.language}
                onChange={handleEditorChange}
                onSave={handleSaveActiveFile}
              />
            ) : (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                  fontSize: '13px',
                }}
              >
                Select a file from the explorer to begin editing
              </div>
            )}
          </div>

          {/* Dockable Bottom Panel (Terminal / Preview / Git) */}
          {showBottomPanel && (
            <div
              style={{
                height: '240px',
                borderTop: '1px solid #1e293b',
                display: 'flex',
                flexDirection: 'column',
                background: '#090d16',
              }}
            >
              {bottomTab === 'terminal' && <TerminalPanel />}
              {bottomTab === 'preview' && <LivePreview />}
              {bottomTab === 'git' && <GitDiffViewer />}
            </div>
          )}
        </div>

        {/* Right: Specialist Coding Agent Sidebar */}
        {showAgentSidebar && (
          <CodingAgentSidebar
            activeFile={activeTabPath}
            onPatchApplied={async (filePath) => {
              await loadWorkspace();
              const openTab = tabs.find((t) => t.path === filePath);
              if (openTab) {
                const refreshed = await ideApi.readFile(filePath);
                setTabs((prev) =>
                  prev.map((t) =>
                    t.path === filePath
                      ? { ...t, content: refreshed.content, hash: refreshed.hash, isDirty: false }
                      : t
                  )
                );
              }
            }}
          />
        )}
      </div>
    </div>
  );
};
