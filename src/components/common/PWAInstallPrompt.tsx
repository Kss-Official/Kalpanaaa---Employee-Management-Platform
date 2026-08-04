import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  
  // Use localStorage to persist the user's choice to dismiss the prompt
  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem('pwaPromptDismissed') === 'true';
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Update UI notify the user they can install the PWA
      if (!isDismissed) {
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If app is already installed, we might get appinstalled event
    window.addEventListener('appinstalled', () => {
      setIsVisible(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isDismissed]);

  // FALLBACK & AUTO-HIDE LOGIC
  useEffect(() => {
    // 1. Show after 5 seconds (waits for splash screen)
    const showTimer = setTimeout(() => {
      if (!isVisible && !isDismissed) {
        setIsVisible(true);
      }
    }, 5000);
    
    // 2. Hide automatically 25 seconds after it appears (total 30s from load)
    const hideTimer = setTimeout(() => {
      setIsVisible(false);
    }, 30000); // 5s wait + 25s visible
    
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [isVisible, isDismissed]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Check if user is on iOS (iPhone, iPad, iPod)
      const isIOS = 
        /iPad|iPhone|iPod/.test(navigator.userAgent) || 
        (navigator.userAgent.includes("Mac") && "ontouchend" in document);

      if (isIOS) {
        alert("To install on iPhone/iPad: \n\n1. Tap the 'Share' icon (square with an up arrow) at the bottom of Safari.\n2. Scroll down and tap 'Add to Home Screen'.");
      } else {
        // If the browser didn't give us the native prompt, we must instruct the user
        alert("To install: Please look at your browser's address bar (top right) and click the Install icon, or open the browser menu and select 'Install App'.");
      }
      
      setIsVisible(false);
      return;
    }
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    // We no longer need the prompt. Clear it up.
    setDeferredPrompt(null);
    setIsVisible(false);

    if (outcome === 'dismissed') {
       setIsDismissed(true);
       localStorage.setItem('pwaPromptDismissed', 'true');
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem('pwaPromptDismissed', 'true');
  };

  // Do not show if already in standalone mode (already installed)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
                       || (window.navigator as any).standalone === true;
                       
  if (!isVisible || isStandalone) return null;

  return (
    <div className="fixed top-20 right-4 sm:top-24 sm:right-8 z-[9999] bg-slate-900 border border-blue-500/40 shadow-2xl shadow-blue-500/20 rounded-2xl p-5 max-w-sm flex items-start gap-4 animate-slide-in-up">
      <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 text-white shadow-lg shadow-blue-500/30">
        <Download className="w-6 h-6" />
      </div>
      
      <div className="flex-1 min-w-0 pt-0.5">
        <h3 className="text-base font-bold text-white mb-1">Install KSS App</h3>
        <p className="text-sm text-slate-400 mb-4 leading-relaxed">
          Install our app on your device for a faster, seamless, and app-like experience!
        </p>
        
        <div className="flex gap-3">
          <button 
            onClick={handleInstallClick}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-2 px-3 rounded-xl transition-all shadow-md shadow-blue-600/20 active:scale-95"
          >
            Install Now
          </button>
          <button 
            onClick={handleDismiss}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold py-2 px-3 rounded-xl transition-all active:scale-95"
          >
            Maybe Later
          </button>
        </div>
      </div>

      <button 
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-slate-500 hover:text-white bg-slate-800/50 hover:bg-slate-700 p-1.5 rounded-full transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
