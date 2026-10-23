import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { Globe, ExternalLink, ChevronDown, ChevronUp, X } from 'lucide-react';

export const WebsiteActivityOverlay: React.FC = () => {
  const { activeWebsiteActivity, setActiveWebsiteActivity } = useAppStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [imageError, setImageError] = useState(false);

  if (!activeWebsiteActivity) {
    return null;
  }

  const {
    agentRole = 'Research Specialist',
    websiteName,
    domain,
    url,
    action,
    status,
    faviconUrl,
    screenshotUrl,
    productTitle,
    productPrice,
    budgetINR,
  } = activeWebsiteActivity;

  const handleClose = () => {
    setActiveWebsiteActivity(null);
  };

  const statusLabel =
    status === 'running'
      ? 'Running'
      : status === 'completed'
      ? 'Completed'
      : status === 'failed'
      ? 'Failed'
      : 'Cancelled';

  const statusColor =
    status === 'running'
      ? '#111111'
      : status === 'completed'
      ? '#4b5563'
      : status === 'failed'
      ? '#dc2626'
      : '#6b7280';

  return (
    <div
      role="region"
      aria-label="Live Website Activity Overlay"
      style={{
        position: 'fixed',
        bottom: '88px',
        right: '24px',
        width: isCollapsed ? '280px' : '360px',
        maxWidth: 'calc(100vw - 48px)',
        background: '#FFFFFF',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        zIndex: 999,
        fontFamily: 'inherit',
        overflow: 'hidden',
        transition: 'width 0.2s ease, height 0.2s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: '#f9fafb',
          borderBottom: isCollapsed ? 'none' : '1px solid #e5e7eb',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: status === 'running' ? '#111111' : '#9ca3af',
              animation: status === 'running' ? 'pulse 1.5s infinite' : 'none',
            }}
          />
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: '#111111',
              textTransform: 'uppercase',
            }}
          >
            Karma Web Activity
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? 'Expand overlay' : 'Collapse overlay'}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {isCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close overlay"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      {!isCollapsed && (
        <div style={{ padding: '12px 14px', fontSize: '13px', color: '#111111' }}>
          {/* Metadata rows */}
          <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', rowGap: '6px', marginBottom: '10px' }}>
            <span style={{ color: '#6b7280', fontSize: '12px' }}>Agent:</span>
            <span style={{ fontWeight: 600, color: '#111111' }}>{agentRole}</span>

            <span style={{ color: '#6b7280', fontSize: '12px' }}>Website:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
              {faviconUrl ? (
                <img
                  src={faviconUrl}
                  alt=""
                  style={{ width: '14px', height: '14px', borderRadius: '2px', flexShrink: 0 }}
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <Globe size={14} color="#6b7280" />
              )}
              <span
                style={{
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {websiteName || domain}
              </span>
            </div>

            <span style={{ color: '#6b7280', fontSize: '12px' }}>Domain:</span>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#4b5563',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {domain}
            </span>

            <span style={{ color: '#6b7280', fontSize: '12px' }}>Action:</span>
            <span style={{ color: '#111111' }}>{action}</span>

            <span style={{ color: '#6b7280', fontSize: '12px' }}>Status:</span>
            <span style={{ fontWeight: 600, color: statusColor }}>{statusLabel}</span>
          </div>

          {/* Live Product Intelligence Box if available */}
          {(productTitle || productPrice) && (
            <div
              style={{
                marginTop: '10px',
                marginBottom: '10px',
                padding: '9px 12px',
                borderRadius: '6px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Live Product
                </span>
                {productPrice && (
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a' }}>
                    {productPrice} {budgetINR ? `(Under ₹${budgetINR})` : ''}
                  </span>
                )}
              </div>
              {productTitle && (
                <div style={{ fontSize: '12px', fontWeight: 500, color: '#0f172a', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {productTitle}
                </div>
              )}
            </div>
          )}

          {/* Screenshot / page preview when available */}
          {screenshotUrl && !imageError && (
            <div
              style={{
                marginTop: '10px',
                marginBottom: '10px',
                borderRadius: '6px',
                overflow: 'hidden',
                border: '1px solid #e5e7eb',
                maxHeight: '130px',
              }}
            >
              <img
                src={screenshotUrl}
                alt="Page screenshot"
                style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }}
                onError={() => setImageError(true)}
              />
            </div>
          )}

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '8px',
              borderTop: '1px solid #f3f4f6',
              marginTop: '8px',
            }}
          >
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: '#111111',
                  textDecoration: 'underline',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                Open website <ExternalLink size={12} />
              </a>
            )}
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#6b7280',
                fontSize: '12px',
                cursor: 'pointer',
                padding: '2px 6px',
              }}
            >
              Collapse
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
