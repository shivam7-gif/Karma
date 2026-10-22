import React, { useState } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FilePlus,
  FolderPlus,
  Trash2,
  ChevronRight,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import type { WorkspaceFileNode } from '../../types/ide';

interface FileExplorerProps {
  tree: WorkspaceFileNode[];
  activeFilePath?: string;
  onSelectFile: (node: WorkspaceFileNode) => void;
  onCreateEntry: (type: 'file' | 'directory', parentPath: string) => void;
  onDeleteEntry: (path: string) => void;
  onRefresh: () => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  tree,
  activeFilePath,
  onSelectFile,
  onCreateEntry,
  onDeleteEntry,
  onRefresh,
}) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleCollapse = (path: string) => {
    setCollapsed((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const renderNode = (node: WorkspaceFileNode, level = 0) => {
    const isDir = node.type === 'directory';
    const isExpanded = !collapsed[node.relativePath];
    const isActive = activeFilePath === node.relativePath;

    return (
      <div key={node.relativePath} style={{ paddingLeft: `${level * 12}px` }}>
        <div
          className={`ide-tree-node ${isActive ? 'active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '3px 6px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            color: isActive ? '#fff' : '#cbd5e1',
            background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
            userSelect: 'none',
          }}
          onClick={() => {
            if (isDir) {
              toggleCollapse(node.relativePath);
            } else {
              onSelectFile(node);
            }
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
            {isDir ? (
              <>
                {isExpanded ? <ChevronDown size={14} color="#94a3b8" /> : <ChevronRight size={14} color="#94a3b8" />}
                {isExpanded ? <FolderOpen size={14} color="#38bdf8" /> : <Folder size={14} color="#38bdf8" />}
              </>
            ) : (
              <>
                <span style={{ width: '14px' }} />
                {node.extension?.match(/ts|tsx|js|jsx/) ? (
                  <FileCode size={14} color="#60a5fa" />
                ) : (
                  <FileText size={14} color="#94a3b8" />
                )}
              </>
            )}
            <span
              style={{
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {node.name}
            </span>
          </div>

          <div className="node-actions" style={{ display: 'flex', gap: '4px', opacity: 0.6 }}>
            {isDir && (
              <>
                <button
                  type="button"
                  title="New File"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateEntry('file', node.relativePath);
                  }}
                >
                  <FilePlus size={12} color="#94a3b8" />
                </button>
                <button
                  type="button"
                  title="New Folder"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateEntry('directory', node.relativePath);
                  }}
                >
                  <FolderPlus size={12} color="#94a3b8" />
                </button>
              </>
            )}
            <button
              type="button"
              title="Delete"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete ${node.name}?`)) {
                  onDeleteEntry(node.relativePath);
                }
              }}
            >
              <Trash2 size={12} color="#ef4444" />
            </button>
          </div>
        </div>

        {isDir && isExpanded && node.children && (
          <div>{node.children.map((child) => renderNode(child, level + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0f172a',
        borderRight: '1px solid #1e293b',
        width: '240px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid #1e293b',
          color: '#94a3b8',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        <span>Explorer</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            title="New Root File"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onClick={() => onCreateEntry('file', '')}
          >
            <FilePlus size={14} color="#94a3b8" />
          </button>
          <button
            type="button"
            title="New Root Folder"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onClick={() => onCreateEntry('directory', '')}
          >
            <FolderPlus size={14} color="#94a3b8" />
          </button>
          <button
            type="button"
            title="Refresh"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onClick={onRefresh}
          >
            <RefreshCw size={14} color="#94a3b8" />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
        {tree.length === 0 ? (
          <div style={{ padding: '16px', color: '#64748b', fontSize: '12px', textAlign: 'center' }}>
            No files in workspace
          </div>
        ) : (
          tree.map((node) => renderNode(node))
        )}
      </div>
    </div>
  );
};
