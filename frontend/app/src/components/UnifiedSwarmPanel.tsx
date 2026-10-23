import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import type { ClientOrchestratorTask, ResearchFinding, VisitedWebsite } from '../api/types';
import { ChevronDown, ChevronUp, Globe, ExternalLink, Image as ImageIcon } from 'lucide-react';

interface FindingCardProps {
  finding: ResearchFinding;
}

const FindingCard: React.FC<FindingCardProps> = ({ finding }) => {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontSize: '13px',
      }}
    >
      {/* Photo with consistent aspect ratio */}
      {finding.imageUrl && !imageFailed ? (
        <div style={{ width: '100%', height: '140px', background: '#f3f4f6', position: 'relative' }}>
          <img
            src={finding.imageUrl}
            alt={finding.title}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={() => setImageFailed(true)}
          />
        </div>
      ) : (
        <div
          style={{
            width: '100%',
            height: '80px',
            background: '#f9fafb',
            borderBottom: '1px solid #f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9ca3af',
            gap: '6px',
            fontSize: '12px',
          }}
        >
          <ImageIcon size={16} />
          <span>No image preview</span>
        </div>
      )}

      {/* Card Content */}
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', flex: 1, gap: '6px' }}>
        <div style={{ fontWeight: 600, color: '#111111', fontSize: '13.5px', lineHeight: 1.35 }}>
          {finding.title}
        </div>

        {finding.snippet && (
          <div
            style={{
              color: '#4b5563',
              fontSize: '12px',
              lineHeight: 1.45,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {finding.snippet}
          </div>
        )}

        {finding.price && (
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#111111', marginTop: '2px' }}>
            {finding.price}
          </div>
        )}

        <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {finding.url ? (
            <a
              href={finding.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '11.5px',
                color: '#111111',
                textDecoration: 'underline',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontWeight: 500,
              }}
            >
              View original website <ExternalLink size={10} />
            </a>
          ) : (
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>Source unlinked</span>
          )}

          {finding.agentRole && (
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>
              {finding.agentRole}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const UnifiedSwarmPanel: React.FC = () => {
  const { orchestratorTasks, isStreaming } = useAppStore();
  const [activityExpanded, setActivityExpanded] = useState(false);

  if (!orchestratorTasks || orchestratorTasks.length === 0) {
    return null;
  }

  // 1. Gather all unique visited websites across all tasks
  const websitesMap = new Map<string, VisitedWebsite>();
  const allFindings: ResearchFinding[] = [];

  for (const task of orchestratorTasks) {
    if (task.metadata?.visitedWebsites && Array.isArray(task.metadata.visitedWebsites)) {
      for (const site of task.metadata.visitedWebsites) {
        if (site && site.url && !websitesMap.has(site.url)) {
          websitesMap.set(site.url, site);
        }
      }
    }

    if (task.metadata?.findings && Array.isArray(task.metadata.findings)) {
      for (const f of task.metadata.findings) {
        if (f && f.title) {
          // Avoid duplicate titles
          if (!allFindings.some((existing) => existing.title === f.title)) {
            allFindings.push(f);
          }
        }
      }
    }
  }

  const visitedWebsites = Array.from(websitesMap.values());
  const completedCount = orchestratorTasks.filter((t) => t.status === 'completed').length;
  const totalCount = orchestratorTasks.length;
  const isAllCompleted = completedCount === totalCount && totalCount > 0;

  return (
    <div
      style={{
        width: '100%',
        background: '#FFFFFF',
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        margin: '12px 0 16px 0',
        padding: '14px',
        fontFamily: 'inherit',
      }}
    >
      {/* 1. Agent Activity Section */}
      <div style={{ marginBottom: visitedWebsites.length > 0 || allFindings.length > 0 ? '14px' : '0' }}>
        <button
          type="button"
          onClick={() => setActivityExpanded(!activityExpanded)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'transparent',
            border: 'none',
            padding: '4px 0',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#111111', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Agent Activity
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: isAllCompleted ? '#4b5563' : '#111111',
                background: '#f3f4f6',
                padding: '2px 8px',
                borderRadius: '4px',
              }}
            >
              {completedCount}/{totalCount} Completed
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#6b7280', fontSize: '12px' }}>
            <span>{activityExpanded ? 'Hide' : 'Details'}</span>
            {activityExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </button>

        {/* Specialists status list */}
        {(activityExpanded || isStreaming) && (
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {orchestratorTasks.map((task: ClientOrchestratorTask) => {
              const roleName =
                (task.metadata?.role as string) ||
                (task.agentType === 'synthesis'
                  ? 'Chief Planner'
                  : task.agentType === 'analysis'
                  ? 'Budget Analyst'
                  : task.agentType === 'research'
                  ? 'Research Specialist'
                  : 'Specialist Agent');

              const statusBadge =
                task.status === 'completed'
                  ? 'Completed'
                  : task.status === 'running'
                  ? 'Running'
                  : task.status === 'failed'
                  ? 'Failed'
                  : task.status === 'cancelled'
                  ? 'Cancelled'
                  : 'Waiting';

              const badgeBg =
                task.status === 'completed'
                  ? '#f3f4f6'
                  : task.status === 'running'
                  ? '#111111'
                  : task.status === 'failed'
                  ? '#fee2e2'
                  : '#f9fafb';

              const badgeColor =
                task.status === 'completed'
                  ? '#374151'
                  : task.status === 'running'
                  ? '#FFFFFF'
                  : task.status === 'failed'
                  ? '#b91c1c'
                  : '#6b7280';

              return (
                <div
                  key={task.taskId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    background: '#f9fafb',
                    borderRadius: '4px',
                    fontSize: '12px',
                    border: '1px solid #f3f4f6',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1, marginRight: '12px' }}>
                    <div style={{ fontWeight: 600, color: '#111111' }}>{roleName}</div>
                    <div
                      style={{
                        color: '#6b7280',
                        fontSize: '11px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {task.activity || task.description}
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '3px',
                      background: badgeBg,
                      color: badgeColor,
                      flexShrink: 0,
                    }}
                  >
                    {statusBadge}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Websites Visited Section */}
      {visitedWebsites.length > 0 && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f3f4f6' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
            Websites visited
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {visitedWebsites.map((site) => (
              <a
                key={site.url}
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 10px',
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                  color: '#111111',
                  fontSize: '12px',
                  textDecoration: 'none',
                  maxWidth: '100%',
                }}
              >
                {site.faviconUrl ? (
                  <img
                    src={site.faviconUrl}
                    alt=""
                    style={{ width: '14px', height: '14px', borderRadius: '2px', flexShrink: 0 }}
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <Globe size={13} color="#6b7280" />
                )}
                <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {site.title || site.domain}
                </span>
                <span style={{ color: '#9ca3af', fontSize: '11px', fontFamily: 'monospace' }}>
                  {site.domain}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 3. Research Findings & Photos Section */}
      {allFindings.length > 0 && (
        <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #f3f4f6' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
            Research findings
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '12px',
            }}
          >
            {allFindings.map((finding, idx) => (
              <FindingCard key={`${finding.url}-${idx}`} finding={finding} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
