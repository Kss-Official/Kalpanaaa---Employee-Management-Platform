import React, { useEffect, useState } from 'react';
import kalpanaLogo from '../../assets/images/kalpana_logo.jpeg';
import { useHaptic } from '../../hooks/useHaptic';
import { animations } from '../../lib/animations';

interface SplashScreenProps {
  onFinish?: () => void;
  autoCloseDelay?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish, autoCloseDelay = 4200 }) => {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter');
  const [pulse, setPulse] = useState(false);
  const { triggerHaptic } = useHaptic();

  useEffect(() => {
    // Initial enter haptic
    if (typeof window !== 'undefined') {
      setTimeout(() => triggerHaptic('light'), 200);
      setTimeout(() => triggerHaptic('success'), 800); // when pulse starts
    }
    
    const enterTimer = setTimeout(() => { setPhase('hold'); setPulse(true); }, 800);
    const exitTimer = setTimeout(() => setPhase('exit'), autoCloseDelay - 700);
    const doneTimer = setTimeout(() => { if (onFinish) onFinish(); }, autoCloseDelay);
    return () => { clearTimeout(enterTimer); clearTimeout(exitTimer); clearTimeout(doneTimer); };
  }, [autoCloseDelay, onFinish, triggerHaptic]);

  const handleDismiss = () => {
    triggerHaptic('medium');
    setPhase('exit');
    setTimeout(() => { if (onFinish) onFinish(); }, 600);
  };

  return (
    <div
      onClick={handleDismiss}
      style={{
        opacity: phase === 'exit' ? 0 : 1,
        transition: phase === 'enter' ? 'opacity 0.8s ease-out' : phase === 'exit' ? 'opacity 0.65s ease-in' : undefined,
      }}
      className={`fixed inset-0 z-[9999] bg-[var(--bg-primary)] flex flex-col items-center justify-center cursor-pointer select-none overflow-hidden ${animations.tap}`}
    >
      {/* ── Background: full-bleed dark logo tint ── */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${kalpanaLogo})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'brightness(0.06) blur(24px) saturate(1.8)',
          transform: 'scale(1.08)',
        }}
      />

      {/* ── Edge sweep glow corners ── */}
      <div className="absolute inset-0 pointer-events-none">
        {/* top-left */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-[var(--accent-blue)]/20 rounded-br-full blur-3xl" />
        {/* bottom-right */}
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-[var(--accent-violet)]/20 rounded-tl-full blur-3xl" />
        {/* centre ambient */}
        <div className="absolute inset-0 bg-[var(--gradient-glow)] opacity-70" />
      </div>

      {/* ── Corner border accent lines ── */}
      {['top-0 left-0','top-0 right-0','bottom-0 left-0','bottom-0 right-0'].map((pos, i) => (
        <div
          key={i}
          className={`absolute ${pos} w-14 h-14 pointer-events-none`}
          style={{
            borderTop: ['top-0 left-0','top-0 right-0'].includes(pos) ? '1.5px solid rgba(59,130,246,0.45)' : 'none',
            borderBottom: ['bottom-0 left-0','bottom-0 right-0'].includes(pos) ? '1.5px solid rgba(59,130,246,0.45)' : 'none',
            borderLeft: ['top-0 left-0','bottom-0 left-0'].includes(pos) ? '1.5px solid rgba(59,130,246,0.45)' : 'none',
            borderRight: ['top-0 right-0','bottom-0 right-0'].includes(pos) ? '1.5px solid rgba(59,130,246,0.45)' : 'none',
            opacity: phase === 'hold' ? 1 : 0,
            transition: 'opacity 0.8s ease-out',
          }}
        />
      ))}

      {/* ── Pulsing ring behind logo ── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-[340px] h-[340px] rounded-full border border-[var(--accent-blue)]/20"
          style={{
            animation: pulse ? 'pingRing 2.4s cubic-bezier(0,0,0.2,1) infinite' : 'none',
          }}
        />
        <div
          className="absolute w-[440px] h-[440px] rounded-full border border-[var(--accent-blue)]/10"
          style={{
            animation: pulse ? 'pingRing 2.4s cubic-bezier(0,0,0.2,1) infinite 0.4s' : 'none',
          }}
        />
      </div>

      {/* ── Main logo ── */}
      <div
        className="relative z-10 flex flex-col items-center gap-8"
        style={{
          transform: phase === 'enter' ? 'scale(0.88) translateY(12px)' : 'scale(1) translateY(0)',
          opacity: phase === 'enter' ? 0 : 1,
          transition: 'transform 0.85s var(--ease-spring), opacity 0.85s var(--ease-smooth)',
        }}
      >
        {/* Glowing frame around logo */}
        <div className="relative">
          {/* Outer glow ring */}
          <div
            className="absolute -inset-3 rounded-3xl"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(59,130,246,0.22) 0%, transparent 70%)',
              animation: pulse ? 'breathe 2.8s ease-in-out infinite' : 'none',
            }}
          />
          {/* Subtle shimmering border */}
          <div
            className="absolute -inset-px rounded-3xl"
            style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.3), transparent 40%, rgba(139,92,246,0.25))',
            }}
          />
          <img
            src={kalpanaLogo}
            alt="Kalpanaaa Software Solutions Pvt Ltd"
            className="relative w-[260px] sm:w-[320px] md:w-[380px] max-w-[78vw] max-h-[55vh] object-contain rounded-3xl"
            style={{
              filter: 'drop-shadow(0 0 36px rgba(59,130,246,0.5)) drop-shadow(0 0 70px rgba(59,130,246,0.2))',
            }}
          />
        </div>

        {/* Progress bar */}
        <div className="w-52 sm:w-72 h-[2px] bg-[var(--border-strong)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              background: 'var(--gradient-premium)',
              animation: `loadbar ${autoCloseDelay - 500}ms linear forwards`,
            }}
          />
        </div>

        <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-[var(--text-tertiary)] animate-pulse mt-4">
          Tap anywhere to continue
        </p>
      </div>

      <style>{`
        @keyframes loadbar { from { width: 0% } to { width: 100% } }
        @keyframes pingRing {
          0% { transform: scale(0.92); opacity: 0.6; }
          70%, 100% { transform: scale(1.18); opacity: 0; }
        }
        @keyframes breathe {
          0%, 100% { opacity: 0.6; transform: scale(0.98); }
          50% { opacity: 1; transform: scale(1.04); }
        }
      `}</style>
    </div>
  );
};
