import React from 'react';
import { X, Circle } from 'lucide-react';
import type { EditorTab } from '../../types/ide';

interface EditorTabsProps {
  tabs: EditorTab[];
  activeTabPath?: string;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string) => void;
}

export const EditorTabs: React.FC<EditorTabsProps> = ({
  tabs,
  activeTabPath,
  onSelectTab,
  onCloseTab,
}) => {
  if (tabs.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        background: '#090d16',
        borderBottom: '1px solid #1e293b',
        overflowX: 'auto',
        height: '36px',
        paddingLeft: '4px',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.path === activeTabPath;

        return (
          <div
            key={tab.path}
            onClick={() => onSelectTab(tab.path)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 12px',
              height: '100%',
              fontSize: '12px',
              cursor: 'pointer',
              userSelect: 'none',
              background: isActive ? '#1e293b' : 'transparent',
              color: isActive ? '#f8fafc' : '#94a3b8',
              borderRight: '1px solid #1e293b',
              borderTop: isActive ? '2px solid #38bdf8' : '2px solid transparent',
              transition: 'all 0.15s ease',
            }}
          >
            <span>{tab.name}</span>

            {tab.isDirty && (
              <span title="Unsaved changes" style={{ display: 'inline-flex' }}>
                <Circle size={8} fill="#38bdf8" color="#38bdf8" />
              </span>
            )}

            <button
              type="button"
              title="Close tab"
              style={{
                background: 'none',
                border: 'none',
                padding: '2px',
                cursor: 'pointer',
                borderRadius: '3px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.path);
              }}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
