import React from 'react';
import {
  Home,
  Code,
  History,
  Lightbulb,
  Calendar,
  ListTodo,
  CheckSquare,
  BarChart3,
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

// Group 1: Home
// Group 2: Code, History
// Group 3: Ideas, Calendar, Lists, Tasks
// Group 4: Analytics (Insights)
const NAV_GROUPS: NavButtonConfig[][] = [
  [{ id: 'home', label: 'Home', icon: Home }],
  [
    { id: 'ide', label: 'Code', icon: Code },
    { id: 'history', label: 'History', icon: History },
  ],
  [
    { id: 'ideas', label: 'Ideas', icon: Lightbulb },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'lists', label: 'Lists', icon: ListTodo },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  ],
  [{ id: 'insights', label: 'Analytics', icon: BarChart3 }],
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
      aria-label="Primary Navigation"
      className="floating-side-nav"
    >
      {NAV_GROUPS.map((group, groupIdx) => (
        <React.Fragment key={`group-${groupIdx}`}>
          {groupIdx > 0 && <div className="nav-group-divider" />}

          {group.map((item) => {
            const Icon = item.icon;
            const isActive =
              (item.id === 'ide' && view === 'ide') ||
              (item.id === 'home' && view === 'home') ||
              activeNav === item.id ||
              (item.id === 'lists' && panelOpen);

            return (
              <div key={item.id} className="nav-item-wrapper">
                <button
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  aria-label={item.label}
                  aria-pressed={isActive}
                  className={`nav-btn ${isActive ? 'active' : ''}`}
                >
                  <div className="nav-icon-box">
                    <Icon size={16} strokeWidth={1.5} />
                  </div>
                  <span className="nav-label">{item.label}</span>
                </button>

                {/* Accessible Tooltip when collapsed */}
                <span className="nav-tooltip" role="tooltip">
                  {item.label}
                </span>
              </div>
            );
          })}
        </React.Fragment>
      ))}

      <style>{`
        .floating-side-nav {
          position: fixed;
          left: 20px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 40;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 8px 6px;
          background: #FFFFFF;
          border: 1px solid #E8E3DC;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          gap: 4px;
          width: 44px;
          box-sizing: border-box;
          transition: width 200ms ease-out, padding 200ms ease-out;
          overflow: hidden;
        }

        .floating-side-nav:hover {
          width: 156px;
          padding: 8px;
          align-items: stretch;
        }

        .nav-item-wrapper {
          position: relative;
          width: 100%;
          display: flex;
          justifyContent: center;
        }

        .floating-side-nav:hover .nav-item-wrapper {
          justify-content: flex-start;
        }

        .nav-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: transparent;
          color: #575260;
          border: none;
          cursor: pointer;
          transition: background-color 150ms ease-out, color 150ms ease-out, width 200ms ease-out, padding 200ms ease-out;
          padding: 0;
          box-sizing: border-box;
        }

        .floating-side-nav:hover .nav-btn {
          width: 100%;
          justify-content: flex-start;
          padding: 0 8px;
          gap: 10px;
        }

        .nav-btn.active {
          background: #F3EBFF;
          color: #7C3AED;
        }

        .nav-btn:hover:not(.active) {
          color: #19161D;
          background: #F5F2EE;
        }

        .nav-icon-box {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }

        .nav-label {
          display: none;
          font-size: 13px;
          font-weight: 500;
          font-family: inherit;
          color: inherit;
          white-space: nowrap;
          opacity: 0;
          transition: opacity 150ms ease-out;
        }

        .floating-side-nav:hover .nav-label {
          display: inline-block;
          opacity: 1;
        }

        .nav-btn.active .nav-label {
          font-weight: 600;
          color: #7C3AED;
        }

        .nav-group-divider {
          height: 1px;
          background: #E8E3DC;
          width: 20px;
          margin: 2px auto;
          transition: width 200ms ease-out;
          flex-shrink: 0;
        }

        .floating-side-nav:hover .nav-group-divider {
          width: calc(100% - 12px);
        }

        .nav-tooltip {
          position: absolute;
          left: 100%;
          top: 50%;
          transform: translateY(-50%);
          margin-left: 10px;
          padding: 4px 8px;
          background: #19161D;
          border-radius: 6px;
          color: #FFFFFF;
          fontSize: 11px;
          font-weight: 500;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 150ms ease-out;
          z-index: 50;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }

        .floating-side-nav:not(:hover) .nav-item-wrapper:hover .nav-tooltip,
        .floating-side-nav:not(:hover) .nav-item-wrapper:focus-within .nav-tooltip {
          opacity: 1;
        }

        .floating-side-nav:hover .nav-tooltip {
          display: none !important;
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
            max-width: calc(100vw - 32px) !important;
            padding: 6px 8px !important;
            border-radius: 9999px !important;
            background: #FFFFFF !important;
            border: 1px solid #E8E3DC !important;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08) !important;
            overflow-x: auto !important;
            gap: 2px !important;
          }
          .floating-side-nav:hover {
            width: auto !important;
            padding: 6px 8px !important;
            align-items: center !important;
          }
          .nav-item-wrapper {
            width: auto !important;
          }
          .nav-btn,
          .floating-side-nav:hover .nav-btn {
            width: 32px !important;
            height: 32px !important;
            padding: 0 !important;
            justify-content: center !important;
            gap: 0 !important;
          }
          .nav-label,
          .floating-side-nav:hover .nav-label {
            display: none !important;
          }
          .nav-group-divider,
          .floating-side-nav:hover .nav-group-divider {
            width: 1px !important;
            height: 16px !important;
            margin: 0 3px !important;
          }
          .nav-tooltip {
            display: none !important;
          }
        }
      `}</style>
    </nav>
  );
};

export default SideNav;
