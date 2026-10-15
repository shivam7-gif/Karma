import React, { useEffect, useState } from 'react';
import { X, AlignLeft, Plus, Check } from 'lucide-react';
import { KineticTextReveal } from '@/components/ui/kinetic-text-reveal';
import { initialListData } from '../data/lists';
import type { ListData, ListItem } from '../data/lists';
import { useAppStore } from '../store/appStore';

interface ListPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectList?: (listTitle: string) => void;
}

export const ListPanel: React.FC<ListPanelProps> = ({ isOpen, onClose, onSelectList }) => {
  const [data, setData] = useState<ListData>(initialListData);
  const [isAdding, setIsAdding] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const { setInputValue } = useAppStore();

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleAddCustomList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListTitle.trim()) {
      setIsAdding(false);
      return;
    }
    const newItem: ListItem = {
      id: `cust-${Date.now()}`,
      title: newListTitle.trim(),
      itemCount: 0,
    };
    setData((prev) => ({
      ...prev,
      customLists: [newItem, ...prev.customLists],
    }));
    setNewListTitle('');
    setIsAdding(false);
  };

  const handleItemClick = (item: ListItem) => {
    const prompt = `Show items in ${item.title} list`;
    setInputValue(prompt);
    if (onSelectList) {
      onSelectList(item.title);
    }
  };

  return (
    <>
      {/* Backdrop for mobile / outside click */}
      <div
        className={`list-panel-backdrop ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(4px)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity var(--transition-normal)',
          zIndex: 40,
        }}
      />

      {/* Slide-over Panel */}
      <aside
        role="dialog"
        aria-label="Lists panel"
        aria-modal="true"
        aria-hidden={!isOpen}
        className={`list-slide-panel ${isOpen ? 'open' : ''}`}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '360px',
          maxWidth: '100%',
          height: '100%',
          background: 'var(--surface-glass-panel)',
          backdropFilter: 'var(--blur-heavy)',
          WebkitBackdropFilter: 'var(--blur-heavy)',
          borderLeft: '1px solid var(--border-glass-light)',
          borderTopRightRadius: 'var(--radius-outer)',
          borderBottomRightRadius: 'var(--radius-outer)',
          zIndex: 50,
          boxShadow: 'var(--shadow-panel)',
          display: 'flex',
          flexDirection: 'column',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform var(--transition-normal)',
          overflow: 'hidden',
        }}
      >
        {/* Panel Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px 24px 18px 24px',
            borderBottom: '1px solid var(--border-glass)',
            position: 'relative',
          }}
        >
          <div style={{ flex: 1 }} />
          <h2
            style={{
              fontSize: '17px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
              textAlign: 'center',
              margin: 0,
            }}
          >
            <KineticTextReveal
              text="Lists & Tasks"
              splitBy="characters"
              stagger={0.03}
              distance={10}
              staggerFrom="center"
              className="font-semibold justify-center"
            />
          </h2>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close List Panel (Esc)"
              title="Close (Esc)"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.16)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Panel Body (Scrollable) */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          {/* Section: My Shopping List */}
          <div>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                letterSpacing: '0.02em',
                marginBottom: '12px',
              }}
            >
              My Shopping List
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {data.shoppingLists.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background var(--transition-fast)',
                    width: '100%',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <AlignLeft size={17} style={{ color: 'var(--text-secondary)', opacity: 0.8 }} />
                    <span style={{ fontWeight: 400 }}>{item.title}</span>
                  </div>
                  {item.itemCount !== undefined && (
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {item.itemCount} items
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Section: My Custom Lists */}
          <div>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                letterSpacing: '0.02em',
                marginBottom: '12px',
              }}
            >
              My Custom Lists
            </div>

            {/* + Add Custom List Button / Input */}
            {isAdding ? (
              <form onSubmit={handleAddCustomList} style={{ marginBottom: '14px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--accent-blue)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '6px 10px',
                    gap: '8px',
                  }}
                >
                  <input
                    type="text"
                    value={newListTitle}
                    onChange={(e) => setNewListTitle(e.target.value)}
                    placeholder="List title..."
                    autoFocus
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                    }}
                  />
                  <button
                    type="submit"
                    aria-label="Save list"
                    style={{
                      background: 'var(--accent-blue)',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#FFF',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    aria-label="Cancel"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'transparent',
                  border: '1px dashed rgba(255, 255, 255, 0.16)',
                  color: 'var(--accent-blue)',
                  fontSize: '13px',
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  marginBottom: '14px',
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(76, 141, 255, 0.08)';
                  e.currentTarget.style.borderColor = 'var(--accent-blue)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)';
                }}
              >
                <Plus size={15} />
                <span>Add Custom List</span>
              </button>
            )}

            {/* Custom List Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {data.customLists.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background var(--transition-fast)',
                    width: '100%',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <AlignLeft size={17} style={{ color: 'var(--text-secondary)', opacity: 0.8 }} />
                    <span style={{ fontWeight: 400 }}>{item.title}</span>
                  </div>
                  {item.itemCount !== undefined && (
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {item.itemCount} items
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <style>{`
        @media (max-width: 640px) {
          .list-slide-panel {
            width: 100% !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
    </>
  );
};
