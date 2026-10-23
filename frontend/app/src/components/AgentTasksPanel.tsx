import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { useChatStream } from '../hooks/useChatStream';
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
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Sliders,
  RotateCcw,
  Hotel,
  Train,
  Landmark,
} from 'lucide-react';

export const AgentTasksPanel: React.FC = () => {
  const { orchestratorTasks, cancelOrchestratorTask, cancelAllOrchestratorTasks, isStreaming } = useAppStore();
  const { handleSendMessage } = useChatStream();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedOutput, setExpandedOutput] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState(Date.now());
  const [researchModeOnly, setResearchModeOnly] = useState(true);

  // Parameter tuning state (P2)
  const [targetBudget, setTargetBudget] = useState('10000');
  const [tripDuration, setTripDuration] = useState('3');
  const [showTuner, setShowTuner] = useState(false);

  // Consequential action pending approval state
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);

  useEffect(() => {
    const hasRunning = orchestratorTasks.some((t) => t.status === 'running');
    if (!hasRunning) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [orchestratorTasks]);

  // Poll for pending consequential action approvals
  useEffect(() => {
    let isMounted = true;
    const fetchApprovals = async () => {
      try {
        const res = await fetch('/api/approval/pending');
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setPendingApprovals(data.pending || []);
        }
      } catch {
        // silent fallback
      }
    };

    fetchApprovals();
    const interval = setInterval(fetchApprovals, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleRespondApproval = async (id: string, decision: 'approve' | 'reject') => {
    try {
      await fetch(`/api/approval/${id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      setPendingApprovals((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      console.warn('Failed to submit approval response:', e);
    }
  };

  const handleReplan = () => {
    const prompt = `Plan a ${tripDuration}-day Jaipur trip under ₹${targetBudget}.`;
    handleSendMessage(prompt);
  };

  if (!orchestratorTasks || orchestratorTasks.length === 0) {
    return null;
  }

  const completedCount = orchestratorTasks.filter((t) => t.status === 'completed').length;
  const totalCount = orchestratorTasks.length;
  const runningCount = orchestratorTasks.filter((t) => t.status === 'running').length;
  const failedCount = orchestratorTasks.filter((t) => t.status === 'failed').length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  // Mission overall status string
  const getOverallStatus = () => {
    if (completedCount === totalCount) return { text: 'Mission Completed', color: '#34d399', bg: 'rgba(52, 211, 153, 0.15)' };
    if (runningCount > 1) return { text: `${runningCount} Specialists Active Concurrently`, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' };
    if (runningCount === 1) {
      const active = orchestratorTasks.find((t) => t.status === 'running');
      if (active?.agentType === 'analysis') return { text: 'Analyzing Budget & Feasibility', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.15)' };
      if (active?.agentType === 'synthesis') return { text: 'Chief Planner Synthesizing Deliverables', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' };
      return { text: 'Specialist Executing Live Tool Research', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' };
    }
    if (failedCount > 0) return { text: 'Completed with Partial Results', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' };
    return { text: 'Initializing Mission Swarm', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' };
  };

  const overall = getOverallStatus();

  const formatElapsed = (startedAt?: string, completedAt?: string) => {
    if (!startedAt) return '--:--';
    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : now;
    const diffSec = Math.max(0, Math.floor((end - start) / 1000));
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getAgentConfig = (agentType: string, description: string) => {
    const desc = description.toLowerCase();
    if (desc.includes('accommodation') || desc.includes('hotel') || desc.includes('hostel')) {
      return { label: 'Accommodation Specialist', icon: Hotel, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.3)' };
    }
    if (desc.includes('transport') || desc.includes('transit') || desc.includes('train')) {
      return { label: 'Transport Specialist', icon: Train, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)' };
    }
    if (desc.includes('attractions') || desc.includes('monument') || desc.includes('itinerary') || desc.includes('sightseeing')) {
      return { label: 'Attractions Specialist', icon: Landmark, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)', border: 'rgba(236, 72, 153, 0.3)' };
    }

    switch (agentType) {
      case 'coding':
        return { label: 'Coding Engine', icon: Code, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.3)' };
      case 'analysis':
        return { label: 'Budget & Feasibility Analyst', icon: BarChart2, color: '#c084fc', bg: 'rgba(192, 132, 252, 0.12)', border: 'rgba(192, 132, 252, 0.3)' };
      case 'synthesis':
        return { label: 'Chief Planner Synthesis', icon: Layers, color: '#34d399', bg: 'rgba(52, 211, 153, 0.12)', border: 'rgba(52, 211, 153, 0.3)' };
      case 'browser':
        return { label: 'Browser Automation Agent', icon: Globe, color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.3)' };
      case 'research':
      default:
        return { label: 'Research Specialist', icon: Search, color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.12)', border: 'rgba(96, 165, 250, 0.3)' };
    }
  };

  const toggleOutput = (taskId: string) => {
    setExpandedOutput((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  // Helper to extract clickable URLs from task result
  const extractUrls = (text?: string): string[] => {
    if (!text) return [];
    const matches = text.match(/https?:\/\/[^\s)\]"]+/g) || [];
    return Array.from(new Set(matches)).slice(0, 5);
  };

  // Format short domain name for badges
  const getDomainLabel = (urlStr: string) => {
    try {
      return new URL(urlStr).hostname.replace(/^www\./, '');
    } catch {
      return 'Source Link';
    }
  };

  return (
    <div
      style={{
        width: '100%',
        margin: '14px 0',
        background: '#090d16',
        borderRadius: '14px',
        border: '1px solid #1e293b',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.55)',
        padding: '16px 18px',
        color: '#f8fafc',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        overflow: 'hidden',
      }}
    >
      {/* Top Header & Mission Identity */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          paddingBottom: '12px',
          borderBottom: '1px solid #1e293b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '9px',
              background: 'linear-gradient(135deg, #38bdf8, #818cf8, #a855f7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(56, 189, 248, 0.4)',
            }}
          >
            <Sparkles size={18} color="#090d16" />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: '#f8fafc',
                }}
              >
                Karma Agent Swarm · Mission Control
              </span>

              {/* Overall State Badge */}
              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: overall.bg,
                  border: `1px solid ${overall.color}`,
                  color: overall.color,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: overall.color,
                  }}
                />
                {overall.text}
              </span>

              {/* Progress Count */}
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: "'Fira Code', monospace",
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(30, 41, 59, 0.7)',
                  color: '#94a3b8',
                }}
              >
                {completedCount}/{totalCount} Done ({progressPercent}%)
              </span>
            </div>
          </div>
        </div>

        {/* Right Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Research Only Mode Safeguard Badge */}
          <button
            type="button"
            onClick={() => setResearchModeOnly(!researchModeOnly)}
            title="Toggle between Research & Advisory mode vs Action mode"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11px',
              padding: '4px 10px',
              background: researchModeOnly ? 'rgba(52, 211, 153, 0.12)' : 'rgba(245, 158, 11, 0.12)',
              border: `1px solid ${researchModeOnly ? 'rgba(52, 211, 153, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
              color: researchModeOnly ? '#34d399' : '#f59e0b',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            <ShieldCheck size={13} />
            <span>{researchModeOnly ? 'Research Mode' : 'Booking Allowed'}</span>
          </button>

          {/* Mission Tuner Toggle (P2) */}
          <button
            type="button"
            onClick={() => setShowTuner(!showTuner)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              padding: '4px 8px',
              background: showTuner ? '#1e293b' : 'transparent',
              border: '1px solid #1e293b',
              color: '#cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            <Sliders size={13} />
            <span>Tune</span>
          </button>

          {/* Cancel All */}
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
              Cancel Mission
            </button>
          )}

          {/* Collapse / Expand */}
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
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {/* Gradient Multi-Stage Progress Bar */}
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
            background: 'linear-gradient(90deg, #38bdf8, #818cf8, #a855f7, #34d399)',
            transition: 'width 0.4s ease',
            borderRadius: '2px',
          }}
        />
      </div>

      {/* Interactive Mission Tuner Drawer (P2 requirement) */}
      {showTuner && (
        <div
          style={{
            background: '#040711',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            padding: '10px 14px',
            margin: '8px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Target Budget:</span>
              <div style={{ display: 'flex', alignItems: 'center', background: '#090d16', border: '1px solid #334155', borderRadius: '4px', padding: '2px 6px' }}>
                <span style={{ color: '#38bdf8', fontSize: '12px', marginRight: '2px' }}>₹</span>
                <input
                  type="text"
                  value={targetBudget}
                  onChange={(e) => setTargetBudget(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '12px', width: '70px', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Duration:</span>
              <div style={{ display: 'flex', alignItems: 'center', background: '#090d16', border: '1px solid #334155', borderRadius: '4px', padding: '2px 6px' }}>
                <input
                  type="text"
                  value={tripDuration}
                  onChange={(e) => setTripDuration(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '12px', width: '30px', outline: 'none' }}
                />
                <span style={{ color: '#94a3b8', fontSize: '12px' }}>Days</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReplan}
            disabled={isStreaming}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
              color: '#090d16',
              fontWeight: 700,
              fontSize: '11px',
              borderRadius: '6px',
              border: 'none',
              cursor: isStreaming ? 'not-allowed' : 'pointer',
              opacity: isStreaming ? 0.6 : 1,
            }}
          >
            <RotateCcw size={12} />
            <span>Re-plan Mission</span>
          </button>
        </div>
      )}

      {/* Consequential Action Approval Card (P0/P2 requirement) */}
      {pendingApprovals.map((apr) => (
        <div
          key={apr.id}
          style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: '8px',
            padding: '12px 14px',
            margin: '10px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={20} color="#f59e0b" />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#fbbf24' }}>
                Approval Required: {apr.title}
              </div>
              <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
                {apr.description} {apr.amountINR ? `(Estimated: ₹${apr.amountINR.toLocaleString()})` : ''}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => handleRespondApproval(apr.id, 'approve')}
              style={{
                background: '#10b981',
                color: '#fff',
                border: 'none',
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Approve Action
            </button>
            <button
              type="button"
              onClick={() => handleRespondApproval(apr.id, 'reject')}
              style={{
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reject
            </button>
          </div>
        </div>
      ))}

      {/* Tasks List */}
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
          {orchestratorTasks.map((task) => {
            const role = getAgentConfig(task.agentType, task.description);
            const RoleIcon = role.icon;
            const isOutputExpanded = !!expandedOutput[task.taskId];
            const urls = extractUrls(task.result);

            return (
              <div
                key={task.taskId}
                style={{
                  background: '#040711',
                  border: task.status === 'running' ? `1px solid ${role.color}` : '1px solid #1e293b',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: task.status === 'running' ? `0 0 16px ${role.bg}` : 'none',
                  transition: 'all 0.3s ease',
                }}
              >
                {/* Task Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {/* Role Pill */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '3px 9px',
                        borderRadius: '6px',
                        background: role.bg,
                        border: `1px solid ${role.border}`,
                        color: role.color,
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      <RoleIcon size={13} />
                      <span>{role.label}</span>
                    </div>

                    <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                      ({task.taskId.split('-').slice(-1)[0]})
                    </span>

                    {/* Status Indicator */}
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
                          gap: '5px',
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
                            animation: 'pulse 1.5s infinite',
                          }}
                        />
                        ACTIVE CONCURRENTLY
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
                        QUEUED (DAG PREREQ)
                      </span>
                    )}
                  </div>

                  {/* Right Header: Timer & Cancel */}
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

                {/* Live Tool Execution Activity Ticker (P1 requirement) */}
                {task.status === 'running' && task.activity && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      background: 'rgba(56, 189, 248, 0.08)',
                      border: '1px solid rgba(56, 189, 248, 0.2)',
                      color: '#7dd3fc',
                      fontSize: '11px',
                      fontFamily: "'Fira Code', monospace",
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#38bdf8',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {task.activity}
                    </span>
                  </div>
                )}

                {/* Clickable Source Links (P1 requirement) */}
                {urls.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Verified Sources:</span>
                    {urls.map((u, i) => (
                      <a
                        key={i}
                        href={u}
                        target="_blank"
                        rel="noreferrer noopener"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '10px',
                          color: '#38bdf8',
                          background: 'rgba(56, 189, 248, 0.08)',
                          border: '1px solid rgba(56, 189, 248, 0.25)',
                          borderRadius: '4px',
                          padding: '1px 6px',
                          textDecoration: 'none',
                        }}
                      >
                        <span>{getDomainLabel(u)}</span>
                        <ExternalLink size={9} />
                      </a>
                    ))}
                  </div>
                )}

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
                        color: role.color,
                        marginBottom: isOutputExpanded ? '6px' : '0',
                      }}
                      onClick={() => toggleOutput(task.taskId)}
                    >
                      <span>{role.label} Output & Findings</span>
                      <span style={{ color: '#64748b', fontSize: '10px' }}>
                        {isOutputExpanded ? 'Show Less ▲' : 'Show Full Findings ▼'}
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
                        maxHeight: isOutputExpanded ? '350px' : '42px',
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
