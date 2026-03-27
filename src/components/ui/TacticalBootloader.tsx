import React, { useState, useEffect, useRef } from 'react';
import { Activity, ShieldCheck, Database, Server, Fingerprint } from 'lucide-react';

/**
 * AION VISION HUB: Tactical Bootloader
 * Displays a highly-imposing initialization sequence before yielding the Main Application Route.
 */
export default function TacticalBootloader() {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('ESTABLISHING SECURE CONNECTION...');
  const statusTextRef = useRef(statusText);
  statusTextRef.current = statusText;

  useEffect(() => {
    const sequence = [
      { t: 15, text: 'MOUNTING ROOT FILESYSTEM...' },
      { t: 30, text: 'INITIALIZING POSTGRES VECTOR DB...' },
      { t: 45, text: 'CONFIGURING HLS WEBRTC STREAMS...' },
      { t: 60, text: 'WAKING UP vLLM NEURAL ENGINE...' },
      { t: 80, text: 'TUNING R-ANALYTICS PRECOG MATH...' },
      { t: 95, text: 'DECRYPTING ZERO-TRUST RBAC TOKENS...' },
      { t: 100, text: 'AION C4ISR SYSTEM ONLINE.' }
    ];

    // Smooth random progress chunking
    const ticker = setInterval(() => {
      setProgress(p => {
        const nextP = p + (Math.random() * 8);
        if (nextP > 100) return 100;

        // Find nearest text log threshold
        const stage = sequence.find(s => nextP < s.t);
        if (stage && stage.text !== statusTextRef.current) {
           setStatusText(stage.text);
        } else if (nextP >= 100) {
           setStatusText('AION C4ISR SYSTEM ONLINE.');
        }

        return nextP;
      });
    }, 100);

    return () => clearInterval(ticker);
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] bg-black text-primary overflow-hidden flex flex-col items-center justify-center font-mono select-none">
      
      {/* Background Matrix Effect (Subtle) */}
      <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary via-black to-black animate-pulse" />
      
      <div className="relative z-10 w-full max-w-lg px-8 flex flex-col items-center">
        
        {/* Hex Shield Logo */}
        <div className="relative mb-8">
           <ShieldCheck className="h-24 w-24 text-primary opacity-20 animate-[spin_4s_linear_infinite]" />
           <Activity className="h-12 w-12 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_15px_#00ff88]" />
           
           <div className="absolute -inset-4 border border-primary/20 rounded-full animate-ping opacity-20" style={{ animationDuration: '2s' }} />
        </div>

        {/* Brand Text */}
        <h1 className="text-3xl font-extrabold tracking-[0.3em] text-white mb-2 drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">VANGUARD <span className="text-primary italic">OS</span></h1>
        <p className="text-xs text-primary/70 tracking-widest mb-12 uppercase">{statusText}</p>

        {/* Progress Bar Container */}
        <div className="w-full relative">
           
           {/* Cyber-metrics lines */}
           <div className="flex justify-between text-[8px] text-primary/40 mb-1">
              <span>SYS.MEM 0x00FF</span>
              <span>NET.PORT 3000</span>
           </div>

           <div className="h-1.5 w-full bg-primary/10 rounded-full overflow-hidden border border-primary/20">
             <div 
               className="h-full bg-primary relative transition-all duration-75 ease-out shadow-[0_0_10px_#00ff88]" 
               style={{ width: `${progress}%` }}
             >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent w-[50px] animate-[slide_1s_infinite]" />
             </div>
           </div>

        </div>

        {/* Footer Metrics */}
        <div className="mt-8 flex gap-8 justify-center text-[9px] text-primary/30 grayscale">
            <div className="flex flex-col items-center"><Database className="h-4 w-4 mb-1" /> PGVECTOR</div>
            <div className="flex flex-col items-center"><Server className="h-4 w-4 mb-1" /> FASTIFY</div>
            <div className="flex flex-col items-center"><Fingerprint className="h-4 w-4 mb-1" /> BIOMETRICS</div>
        </div>

      </div>

      <style>{`
        @keyframes slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(500px); }
        }
      `}</style>

    </div>
  );
}
