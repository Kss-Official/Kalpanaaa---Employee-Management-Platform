/**
 * MobileBlockGate -- Desktop-Only Hardware Gate.
 *
 * Hard blocks mobile and tablet devices at the application root.
 * Detects and blocks mobile devices even when "Desktop Site" / "Desktop Mode"
 * is enabled in mobile browsers (Android Chrome, iOS Safari, etc.).
 *
 * There is NO bypass or "continue anyway" option.
 */

import React, { useState, useEffect } from 'react';
import { Monitor, Copy, Check, ShieldAlert, Laptop } from 'lucide-react';
import { isMobileOrTabletDevice } from '../../lib/deviceDetection';

interface MobileBlockGateProps {
  children: React.ReactNode;
}

export const MobileBlockGate: React.FC<MobileBlockGateProps> = ({ children }) => {
  const [isMobile, setIsMobile] = useState<boolean>(() => isMobileOrTabletDevice());
  const [copied, setCopied] = useState(false);
  const PORTAL_URL = 'https://www.kalpanaaasoftwaresolutions.in/';

  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(isMobileOrTabletDevice());
    };

    // Check on resize and orientation change in case user rotates or changes mode
    window.addEventListener('resize', checkDevice);
    window.addEventListener('orientationchange', checkDevice);

    // Periodic safety check
    const interval = setInterval(checkDevice, 2000);

    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
      clearInterval(interval);
    };
  }, []);

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(PORTAL_URL).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }).catch(() => {});
    }
  };

  // If detected as mobile or tablet (including Desktop Mode), block completely:
  if (isMobile) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999999,
          background: '#020617',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif',
          overflowY: 'auto',
          boxSizing: 'border-box'
        }}
        aria-label="Desktop Only Notice"
        role="alert"
      >
        <div
          style={{
            position: 'absolute',
            top: '-20%',
            left: '-20%',
            width: '140%',
            height: '70%',
            background: 'radial-gradient(ellipse at center, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
            pointerEvents: 'none'
          }}
        />

        <div style={{ position: 'relative', maxWidth: '380px', width: '100%', margin: 'auto' }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 22,
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 0 40px rgba(239, 68, 68, 0.2)'
            }}
          >
            <ShieldAlert style={{ width: 38, height: 38, color: '#f87171' }} />
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 999,
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fbbf24',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 16
            }}
          >
            <Monitor style={{ width: 14, height: 14 }} />
            Desktop / Laptop Required
          </div>

          <h1
            style={{
              color: '#f8fafc',
              fontSize: 22,
              fontWeight: 900,
              lineHeight: 1.25,
              margin: '0 0 12px',
              letterSpacing: '-0.02em'
            }}
          >
            Access Restricted on Mobile
          </h1>

          <p
            style={{
              color: '#94a3b8',
              fontSize: 13,
              lineHeight: 1.6,
              margin: '0 0 12px'
            }}
          >
            The <strong style={{ color: '#e2e8f0' }}>Kalpanaaa HRMS Platform</strong> is strictly designed for desktop and laptop web browsers.
          </p>

          <div
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(51, 65, 85, 0.6)',
              borderRadius: 14,
              padding: '14px 16px',
              textAlign: 'left',
              marginBottom: 18
            }}
          >
            {([
              ['💻', 'Open on a Windows, Mac, or Linux computer'],
              ['📷', 'Requires physical webcam for facial biometric check-in'],
              ['🚫', 'Mobile devices (including Desktop Mode) are blocked'],
              ['🔒', 'Secure internal employee workspace']
            ] as [string, string][]).map(([icon, text]) => (
              <div
                key={text}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '6px 0',
                  borderBottom: '1px solid rgba(51, 65, 85, 0.3)',
                  fontSize: 12,
                  color: '#94a3b8',
                  lineHeight: 1.45
                }}
              >
                <span style={{ fontSize: 14 }}>{icon}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>

          <div
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(51, 65, 85, 0.5)',
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 16,
              textAlign: 'left'
            }}
          >
            <p style={{ color: '#64748b', fontSize: 10, margin: '0 0 4px', fontWeight: 700, letterSpacing: '0.05em' }}>
              WORKSPACE URL
            </p>
            <p
              style={{
                color: '#93c5fd',
                fontSize: 12,
                fontFamily: 'monospace',
                margin: 0,
                wordBreak: 'break-all'
              }}
            >
              {PORTAL_URL}
            </p>
          </div>

          <button
            onClick={handleCopy}
            style={{
              width: '100%',
              padding: '13px 0',
              background: copied ? 'rgba(16, 185, 129, 0.9)' : 'rgba(59, 130, 246, 0.9)',
              border: 'none',
              borderRadius: 12,
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
              transition: 'background 0.2s',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)'
            }}
          >
            {copied ? (
              <>
                <Check style={{ width: 16, height: 16 }} />
                <span>Portal URL Copied!</span>
              </>
            ) : (
              <>
                <Copy style={{ width: 16, height: 16 }} />
                <span>Copy Portal URL to Open on PC</span>
              </>
            )}
          </button>

          <p
            style={{
              color: '#475569',
              fontSize: 10,
              marginTop: 18,
              lineHeight: 1.5
            }}
          >
            Kalpanaaa Software Solutions · Private Internal Workspace · Desktop Only
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default MobileBlockGate;
