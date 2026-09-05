/**
 * MobileBlockGate -- Hard blocks mobile/phone/tablet devices at the React level.
 *
 * Uses hardware-level signals that CANNOT be spoofed by "Desktop Mode" in
 * Chrome/Safari/Firefox:
 *   1. navigator.maxTouchPoints > 0   -- physical touch hardware
 *   2. 'ontouchstart' in window       -- touch event API presence
 *   3. screen.width / screen.height   -- PHYSICAL screen resolution (not viewport)
 *   4. navigator.platform             -- iOS reports "iPhone"/"iPad" even in Desktop Mode
 *   5. CSS pointer:coarse media query -- hardware input classification
 *
 * Score >= 2 = mobile device. There is NO "continue anyway" bypass.
 */

import React, { useMemo } from 'react';
import { Monitor, Copy, Check, ShieldAlert } from 'lucide-react';

function computeMobileScore(): number {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 0;
  let score = 0;
  if (navigator.maxTouchPoints > 0) score++;
  if ('ontouchstart' in window) score++;
  if (screen.width < 900) score++;
  const platform = (navigator.platform || '').toLowerCase();
  if (platform.includes('iphone') || platform.includes('ipad') || platform.includes('android') || platform.includes('arm')) score++;
  try { if (window.matchMedia('(pointer: coarse)').matches) score++; } catch {}
  return score;
}

interface MobileBlockGateProps { children: React.ReactNode; }

export const MobileBlockGate: React.FC<MobileBlockGateProps> = ({ children }) => {
  const [copied, setCopied] = React.useState(false);
  const PORTAL_URL = 'https://www.kalpanaaasoftwaresolutions.in/';
  const isMobileDevice = useMemo(() => computeMobileScore() >= 2, []);

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(PORTAL_URL).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    }
  };

  if (!isMobileDevice) return <>{children}</>;

  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:999999, background:'#020617',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        padding:'24px', textAlign:'center', fontFamily:'-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif',
        overflowY:'auto' }}
      aria-label="Desktop only notice" role="alert"
    >
      <div style={{ position:'absolute', top:'-20%', left:'-20%', width:'140%', height:'70%',
        background:'radial-gradient(ellipse at center, rgba(59,130,246,0.08) 0%, transparent 70%)',
        pointerEvents:'none' }} />

      <div style={{ position:'relative', maxWidth:'340px', width:'100%' }}>
        <div style={{ width:72, height:72, borderRadius:20, background:'rgba(239,68,68,0.1)',
          border:'1px solid rgba(239,68,68,0.25)', display:'flex', alignItems:'center',
          justifyContent:'center', margin:'0 auto 24px' }}>
          <ShieldAlert style={{ width:36, height:36, color:'#f87171' }} />
        </div>

        <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 12px',
          borderRadius:999, background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.25)',
          color:'#fbbf24', fontSize:10, fontWeight:700, letterSpacing:'0.1em',
          textTransform:'uppercase', marginBottom:16 }}>
          <Monitor style={{ width:12, height:12 }} />
          Desktop Required
        </div>

        <h1 style={{ color:'#f8fafc', fontSize:22, fontWeight:900, lineHeight:1.2,
          margin:'0 0 12px', letterSpacing:'-0.02em' }}>
          Use a Desktop or Laptop
        </h1>

        <p style={{ color:'#94a3b8', fontSize:13, lineHeight:1.65, margin:'0 0 8px' }}>
          The <strong style={{ color:'#e2e8f0' }}>Kalpanaaa HRMS Platform</strong> requires a
          desktop or laptop with a physical webcam for biometric face verification.
        </p>
        <p style={{ color:'#64748b', fontSize:11, lineHeight:1.6, margin:'0 0 28px' }}>
          Mobile and tablet devices — including those using Desktop Mode — are not supported.
          Biometric check-in cannot function correctly on touchscreen hardware.
        </p>

        <div style={{ background:'rgba(15,23,42,0.8)', border:'1px solid rgba(51,65,85,0.6)',
          borderRadius:14, padding:'14px 16px', textAlign:'left', marginBottom:24 }}>
          {([
            ['🖥️','Open on a Windows or Mac desktop/laptop'],
            ['📷','Requires physical webcam for biometric scan'],
            ['🔒','Secure verification — camera access mandatory'],
          ] as [string,string][]).map(([icon,text]) => (
            <div key={text} style={{ display:'flex', alignItems:'flex-start', gap:10,
              padding:'5px 0', borderBottom:'1px solid rgba(51,65,85,0.3)',
              fontSize:11, color:'#94a3b8', lineHeight:1.5 }}>
              <span style={{ fontSize:14 }}>{icon}</span><span>{text}</span>
            </div>
          ))}
        </div>

        <div style={{ background:'rgba(15,23,42,0.6)', border:'1px solid rgba(51,65,85,0.5)',
          borderRadius:10, padding:'10px 14px', marginBottom:16, textAlign:'left' }}>
          <p style={{ color:'#64748b', fontSize:10, margin:'0 0 4px', fontWeight:600 }}>
            PORTAL URL — OPEN ON YOUR COMPUTER
          </p>
          <p style={{ color:'#93c5fd', fontSize:11, fontFamily:'monospace', margin:0, wordBreak:'break-all' }}>
            {PORTAL_URL}
          </p>
        </div>

        <button onClick={handleCopy} style={{ width:'100%', padding:'13px 0',
          background: copied ? 'rgba(16,185,129,0.9)' : 'rgba(59,130,246,0.9)',
          border:'none', borderRadius:12, color:'#fff', fontSize:13, fontWeight:700,
          display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          cursor:'pointer', transition:'background 0.2s' }}>
          {copied
            ? <><Check style={{ width:15, height:15 }} /> Copied! Open on your PC</>
            : <><Copy style={{ width:15, height:15 }} /> Copy Portal URL</>}
        </button>

        <p style={{ color:'#334155', fontSize:10, marginTop:20, lineHeight:1.5 }}>
          Kalpanaaa Software Solutions · Private Internal Workspace · Desktop Only
        </p>
      </div>
    </div>
  );
};

export default MobileBlockGate;
