import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  XCircle,
  Code,
  Search,
  Globe,
  BarChart2,
  Layers,
} from 'lucide-react';

export const AgentTasksPanel: React.FC = () => {
  const { orchestratorTasks, cancelOrchestratorTask, cancelAllOrchestratorTasks } = useAppStore();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedOutput, setExpandedOutput] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const hasRunning = orchestratorTasks.some((t) => t.status === 'running');
    if (!hasRunning) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [orchestratorTasks]);

  if (!orchestratorTasks || orchestratorTasks.length === 0) {
    return null;
  }

  const completedCount = orchestratorTasks.filter((t) => t.status === 'completed').length;
  const totalCount = orchestratorTasks.length;
  const runningCount = orchestratorTasks.filter((t) => t.status === 'running').length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  const formatElapsed = (startedAt?: string, completedAt?: string) => {
    if (!startedAt) return '--:--';
    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : now;
    const diffSec = Math.max(0, Math.floor((end - start) / 1000));
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getAgentConfig = (agentType: string) => {
    switch (agentType) {
      case 'coding':
        return { label: 'Coding Agent', icon: Code, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.3)' };
      case 'analysis':
        return { label: 'Analysis Agent', icon: BarChart2, color: '#c084fc', bg: 'rgba(192, 132, 252, 0.12)', border: 'rgba(192, 132, 252, 0.3)' };
      case 'synthesis':
        return { label: 'Synthesis Agent', icon: Layers, color: '#34d399', bg: 'rgba(52, 211, 153, 0.12)', border: 'rgba(52, 211, 153, 0.3)' };
      case 'research':
        return { label: 'Research Agent', icon: Search, color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.12)', border: 'rgba(96, 165, 250, 0.3)' };
      case 'browser':
        return { label: 'Browser Agent', icon: Globe, color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.3)' };
      default:
        return { label: `${agentType.toUpperCase()} Agent`, icon: Sparkles, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.3)' };
    }
  };

  const toggleOutput = (taskId: string) => {
    setExpandedOutput((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  return (
    <div
      style={{
        width: '100%',
        margin: '14px 0',
        background: '#090d16',
        borderRadius: '12px',
        border: '1px solid #1e293b',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
        padding: '14px 16px',
        color: '#f8fafc',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        overflow: 'hidden',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          paddingBottom: '10px',
          borderBottom: '1px solid #1e293b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={16} color="#090d16" />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: '#f8fafc',
                }}
              >
                Karma Orchestration Engine
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: "'Fira Code', monospace",
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: progressPercent === 100 ? 'rgba(52, 211, 153, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                  border: `1px solid ${progressPercent === 100 ? 'rgba(52, 211, 153, 0.35)' : 'rgba(56, 189, 248, 0.35)'}`,
                  color: progressPercent === 100 ? '#34d399' : '#38bdf8',
                  fontWeight: 600,
                }}
              >
                {completedCount}/{totalCount} Completed · {progressPercent}%
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {runningCount > 0 && (
            <button
              type="button"
              onClick={() => cancelAllOrchestratorTasks()}
              style={{
                fontSize: '11px',
                padding: '4px 10px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Cancel All
            </button>
          )}

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              color: '#94a3b8',
              background: '#1e293b',
              border: 'none',
              padding: '4px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {collapsed ? (
              <>
                <span>Expand</span>
                <ChevronDown size={14} />
              </>
            ) : (
              <>
                <span>Collapse</span>
                <ChevronUp size={14} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Gradient Progress Bar */}
      <div
        style={{
          width: '100%',
          height: '4px',
          background: '#1e293b',
          borderRadius: '2px',
          margin: '10px 0 6px 0',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progressPercent}%`,
            background: 'linear-gradient(90deg, #38bdf8, #818cf8, #34d399)',
            transition: 'width 0.4s ease',
            borderRadius: '2px',
          }}
        />
      </div>

      {/* Task Cards List */}
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
          {orchestratorTasks.map((task) => {
            const role = getAgentConfig(task.agentType);
            const RoleIcon = role.icon;
            const isOutputExpanded = !!expandedOutput[task.taskId];

            return (
              <div
                key={task.taskId}
                style={{
                  background: '#040711',
                  border: '1px solid #1e293b',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                {/* Task Top Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: role.bg,
                        border: `1px solid ${role.border}`,
                        color: role.color,
                        fontSize: '11px',
                        fontWeight: 600,
                      }}
                    >
                      <RoleIcon size={12} />
                      <span>{role.label}</span>
                    </div>

                    <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                      ({task.taskId})
                    </span>

                    {/* Status Pill */}
                    {task.status === 'completed' ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background: 'rgba(52, 211, 153, 0.15)',
                          color: '#34d399',
                          border: '1px solid rgba(52, 211, 153, 0.3)',
                        }}
                      >
                        <CheckCircle2 size={11} /> COMPLETED
                      </span>
                    ) : task.status === 'running' ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background: 'rgba(56, 189, 248, 0.15)',
                          color: '#38bdf8',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                        }}
                      >
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: '#38bdf8',
                          }}
                        />
                        RUNNING
                      </span>
                    ) : task.status === 'failed' ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#f87171',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                        }}
                      >
                        <XCircle size={11} /> FAILED
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background: '#1e293b',
                          color: '#94a3b8',
                        }}
                      >
                        QUEUED
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        color: '#64748b',
                        fontFamily: 'monospace',
                      }}
                    >
                      <Clock size={11} />
                      <span>{formatElapsed(task.startedAt, task.completedAt)}</span>
                    </div>

                    {(task.status === 'running' || task.status === 'queued') && (
                      <button
                        type="button"
                        onClick={() => cancelOrchestratorTask(task.taskId)}
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: '#1e293b',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4' }}>
                  {task.description}
                </div>

                {/* Output Snippet Drawer */}
                {task.result && (
                  <div
                    style={{
                      background: '#02040a',
                      border: '1px solid #1e293b',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      marginTop: '4px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#38bdf8',
                        marginBottom: isOutputExpanded ? '6px' : '0',
                      }}
                      onClick={() => toggleOutput(task.taskId)}
                    >
                      <span>Task Output / Summary</span>
                      <span style={{ color: '#64748b', fontSize: '10px' }}>
                        {isOutputExpanded ? 'Show Less ▲' : 'Show Full Output ▼'}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: '11px',
                        fontFamily: "'Fira Code', Consolas, monospace",
                        color: '#94a3b8',
                        lineHeight: '1.45',
                        whiteSpace: isOutputExpanded ? 'pre-wrap' : 'normal',
                        overflow: 'hidden',
                        maxHeight: isOutputExpanded ? '300px' : '42px',
                        overflowY: isOutputExpanded ? 'auto' : 'hidden',
                        textOverflow: isOutputExpanded ? 'unset' : 'ellipsis',
                      }}
                    >
                      {task.result}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
