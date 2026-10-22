import React from 'react';
import {
  Home,
  History,
  Lightbulb,
  Calendar,
  ListTodo,
  CheckSquare,
  BarChart3,
  Code,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import type { NavItem } from '../store/appStore';

interface NavButtonConfig {
  id: NavItem;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavButtonConfig[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'ide', label: 'IDE Workspace', icon: Code },
  { id: 'history', label: 'History', icon: History },
  { id: 'ideas', label: 'Ideas', icon: Lightbulb },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'lists', label: 'Lists', icon: ListTodo },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'insights', label: 'Insights', icon: BarChart3 },
];

export const SideNav: React.FC = () => {
  const navigate = useNavigate();
  const { activeNav, setActiveNav, togglePanel, panelOpen, setView, view } = useAppStore();

  const handleNavClick = (id: NavItem) => {
    setActiveNav(id);
    if (id === 'lists') {
      togglePanel();
    } else if (id === 'home') {
      setView('home');
      navigate('/dashboard');
    } else if (id === 'ide') {
      setView('ide');
      navigate('/ide');
    }
  };

  return (
    <nav
      aria-label="Sidebar Navigation"
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
        background: 'rgba(255, 255, 255, 0.94)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid var(--border-glass, #e7e2d8)',
        borderRadius: 'var(--r-full, 9999px)',
        boxShadow: 'var(--shadow-soft, 0 4px 20px rgba(0, 0, 0, 0.04))',
        gap: '6px',
        width: '46px',
      }}
    >
      {NAV_ITEMS.map((item) => {
        const IconComponent = item.icon;
        const isActive =
          (item.id === 'ide' && view === 'ide') ||
          (item.id === 'home' && view === 'home') ||
          activeNav === item.id ||
          (item.id === 'lists' && panelOpen);

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
                borderRadius: 'var(--r-sm, 10px)',
                background: isActive ? 'var(--accent, #8b3dff)' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--text-secondary, #575260)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all var(--transition-hover, 120ms ease)',
                boxShadow: isActive ? '0 2px 8px rgba(139, 61, 255, 0.3)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--text-primary, #19161d)';
                  e.currentTarget.style.background = 'var(--surface-glass-hover, #f5f2ec)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--text-secondary, #575260)';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <IconComponent size={17} strokeWidth={1.8} />
            </button>

            {/* Accessible hover/focus tooltip */}
            <span
              className="nav-tooltip"
              role="tooltip"
              style={{
                position: 'absolute',
                left: '100%',
                top: '50%',
                transform: 'translateY(-50%)',
                marginLeft: '10px',
                padding: '4px 9px',
                background: '#19161d',
                borderRadius: '6px',
                color: '#ffffff',
                fontSize: '11.5px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                opacity: 0,
                transition: 'opacity 120ms ease, transform 120ms ease',
                zIndex: 50,
                boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
              }}
            >
              {item.label}
            </span>
          </div>
        );
      })}

      <style>{`
        .nav-item-wrapper:hover .nav-tooltip,
        .nav-item-wrapper:focus-within .nav-tooltip {
          opacity: 1 !important;
          transform: translateY(-50%) translateX(2px) !important;
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
            padding: 6px 10px !important;
            border-radius: var(--r-full, 9999px) !important;
            background: rgba(25, 22, 29, 0.95) !important;
            border-color: rgba(255, 255, 255, 0.1) !important;
          }
          .nav-item-wrapper:hover .nav-tooltip {
            display: none !important;
          }
        }
      `}</style>
    </nav>
  );
};

export default SideNav;
