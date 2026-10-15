import React from 'react';
import {
  Home,
  History,
  Lightbulb,
  Calendar,
  ListTodo,
  CheckSquare,
  BarChart3,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { NavItem } from '../store/appStore';

interface NavButtonConfig {
  id: NavItem;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavButtonConfig[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'history', label: 'History', icon: History },
  { id: 'ideas', label: 'Ideas', icon: Lightbulb },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'lists', label: 'Lists', icon: ListTodo },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'insights', label: 'Insights', icon: BarChart3 },
];

export const SideNav: React.FC = () => {
  const { activeNav, setActiveNav, togglePanel, panelOpen, setView } = useAppStore();

  const handleNavClick = (id: NavItem) => {
    setActiveNav(id);
    if (id === 'lists') {
      togglePanel();
    } else if (id === 'home') {
      setView('home');
    }
  };

  return (
    <nav
      aria-label="Main Navigation"
      className="floating-side-nav"
      style={{
        position: 'absolute',
        left: '24px',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px 6px',
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid #E2E8F0',
        borderRadius: '9999px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
        gap: '8px',
        width: '46px',
      }}
    >
      {NAV_ITEMS.map((item) => {
        const IconComponent = item.icon;
        const isActive = activeNav === item.id || (item.id === 'lists' && panelOpen);

        return (
          <div key={item.id} className="nav-item-wrapper" style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => handleNavClick(item.id)}
              aria-label={item.label}
              aria-pressed={isActive}
              className={`nav-btn ${isActive ? 'active' : ''}`}
              style={{
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: isActive ? '10px' : '50%',
                background: isActive ? '#2563EB' : 'transparent',
                color: isActive ? '#FFFFFF' : '#64748B',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 2px 6px rgba(37, 99, 235, 0.25)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = '#0F172A';
                  e.currentTarget.style.background = '#F1F5F9';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = '#64748B';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <IconComponent size={18} strokeWidth={2} />
            </button>

            {/* Accessible hover tooltip */}
            <span
              className="nav-tooltip"
              role="tooltip"
              style={{
                position: 'absolute',
                left: '100%',
                top: '50%',
                transform: 'translateY(-50%)',
                marginLeft: '12px',
                padding: '4px 10px',
                background: '#1E293B',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                opacity: 0,
                transition: 'opacity 0.15s ease, transform 0.15s ease',
                zIndex: 50,
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              }}
            >
              {item.label}
            </span>
          </div>
        );
      })}


      <style>{`
        .nav-item-wrapper:hover .nav-tooltip {
          opacity: 1 !important;
          transform: translateY(-50%) translateX(4px) !important;
        }
        @media (max-width: 768px) {
          .floating-side-nav {
            position: fixed !important;
            bottom: 16px !important;
            top: auto !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            flex-direction: row !important;
            width: auto !important;
            padding: 6px 12px !important;
            border-radius: var(--radius-full) !important;
            background: rgba(10, 15, 24, 0.92) !important;
          }
          .nav-item-wrapper:hover .nav-tooltip {
            display: none !important;
          }
        }
      `}</style>
    </nav>
  );
};
