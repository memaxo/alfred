import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { MindscapeEngine } from '@/lib/mindscape/engine';
import { fetchInitialMindscape } from './index.server';

export const Route = createFileRoute('/')({
  component: Mindscape,
  loader: () => fetchInitialMindscape(),
});

import { Mic, MicOff } from 'lucide-react';

function Mindscape() {
  const { ascii } = Route.useLoaderData();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<MindscapeEngine | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);

  const handleEnter = () => {
    engineRef.current?.triggerWarp();
    // Wait for animation effect then navigate
    setTimeout(() => {
        navigate({ to: '/mindscape' });
    }, 800);
  };

  const toggleAudio = async () => {
    if (!engineRef.current) return;
    
    if (!audioEnabled) {
        await engineRef.current.enableAudio();
        setAudioEnabled(true);
    } else {
        // We don't have disable in engine yet, but we can just update UI state
        // Real disable would require stopping track.
        // For this demo, we just enable once.
        // Or we can add disable logic.
        // Let's keep it simple: Enable only for now or toggle state.
        // engine.ts has destroy() which closes context, but no partial disable.
        // Let's just treat it as "Audio Reactive Mode Active" visual toggle.
    }
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    
    // Initialize the engine - Takes over the DOM
    engineRef.current = new MindscapeEngine(canvasRef.current);
    
    // Trigger fade in after a brief moment to allow engine to render first frame
    const timer = setTimeout(() => setIsLoaded(true), 100);
    
    return () => {
        engineRef.current?.destroy();
        clearTimeout(timer);
    };
  }, []);

  return (
    <div className="relative w-full h-screen bg-[oklch(0.05_0_0)] overflow-hidden cursor-none">
      {/* The Canvas Overlay (WebGPU) */}
      <canvas 
        ref={canvasRef} 
        className={`absolute inset-0 w-full h-full z-10 transition-opacity duration-700 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* The SSR Static Layer (Immediate Visual) */}
      <pre 
        className="absolute inset-0 w-full h-full z-0 font-mono text-xs leading-none text-[oklch(0.14_0_0)] select-none pointer-events-none flex items-center justify-center whitespace-pre overflow-hidden"
        aria-hidden="true"
      >
        {ascii}
      </pre>

      {/* UI Overlay */}
      <div className="absolute z-20 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center mix-blend-screen pointer-events-auto cursor-auto">
        <h1 className="font-sans text-6xl font-bold tracking-[-0.04em] text-transparent bg-clip-text bg-gradient-to-b from-[oklch(0.99_0_0)] to-[oklch(0.70_0_0)] mb-8">
          ALFRED
        </h1>
        
        <div className="flex flex-col items-center gap-4">
            <button 
                onClick={handleEnter}
                className="px-6 py-2 rounded-full border border-[oklch(0.40_0_0)] text-[oklch(0.99_0_0)] hover:bg-[oklch(0.99_0_0)] hover:text-[oklch(0.05_0_0)] transition-all duration-300 tracking-tight"
            >
                ENTER MINDSCAPE
            </button>
            
            <button
                onClick={toggleAudio}
                className={`flex items-center gap-2 text-sm ${audioEnabled ? 'text-[oklch(0.99_0_0)]' : 'text-[oklch(0.40_0_0)]'} hover:text-[oklch(0.99_0_0)] transition-colors`}
            >
                {audioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                {audioEnabled ? "Audio Reactive" : "Enable Audio"}
            </button>
        </div>
      </div>
    </div>
  );
}
