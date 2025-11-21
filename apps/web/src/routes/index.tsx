import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { MindscapeEngine } from '@/lib/mindscape/engine';
import { fetchInitialMindscape } from './index.server';
import { useVoiceSessionWeb } from '@/hooks/use-voice-session-web';
import { trpc } from '@/utils/trpc';
import { Mic, MicOff, Activity, Volume2 } from 'lucide-react';
import { ScrambleText } from '@/components/scramble-text';

export const Route = createFileRoute('/')({
  component: Mindscape,
  loader: () => fetchInitialMindscape(),
});

function Mindscape() {
  const { ascii } = Route.useLoaderData();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<MindscapeEngine | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);

  const voiceSession = useVoiceSessionWeb(trpc);

  // Sync Agent State with Engine
  useEffect(() => {
    if (!engineRef.current) return;
    
    if (voiceSession.state.isSpeaking) {
        engineRef.current.setAgentState('speaking');
    } else if (voiceSession.state.isProcessing) {
        engineRef.current.setAgentState('processing');
    } else if (voiceSession.state.isRecording) {
        engineRef.current.setAgentState('listening');
    } else {
        engineRef.current.setAgentState('idle');
    }
  }, [voiceSession.state]);

  const handleEnter = () => {
    engineRef.current?.triggerWarp();
    setTimeout(() => {
        navigate({ to: '/mindscape' });
    }, 800);
  };

  const toggleAudio = async () => {
    if (!engineRef.current) return;
    
    if (!audioEnabled) {
        await engineRef.current.enableAudio();
        setAudioEnabled(true);
    }
  };
  
  const toggleVoiceSession = async () => {
    if (voiceSession.state.isRecording || voiceSession.state.isProcessing || voiceSession.state.isSpeaking) {
        voiceSession.clear();
    } else {
        await toggleAudio(); // Ensure mic is active for visualization too
        await voiceSession.start();
    }
  };

  // Push-to-Talk
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
        // Only trigger if not in an input field
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

        if (e.code === 'Space' && !e.repeat && !voiceSession.state.isRecording && !voiceSession.state.isProcessing && !voiceSession.state.isSpeaking) {
            e.preventDefault();
            await toggleAudio(); // Ensure context is active
            await voiceSession.start();
        }
    };

    const handleKeyUp = async (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

        if (e.code === 'Space' && voiceSession.state.isRecording) {
            e.preventDefault();
            await voiceSession.stopAndTranscribe();
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, [voiceSession.state, audioEnabled]); // Re-bind when state changes

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
        
        <div className="flex flex-col items-center gap-6">
            <button 
                onClick={handleEnter}
                className="px-6 py-2 rounded-full border border-[oklch(0.40_0_0)] text-[oklch(0.99_0_0)] hover:bg-[oklch(0.99_0_0)] hover:text-[oklch(0.05_0_0)] transition-all duration-300 tracking-tight"
            >
                ENTER MINDSCAPE
            </button>
            
            <div className="flex gap-4">
                <button
                    onClick={toggleAudio}
                    className={`flex items-center gap-2 text-sm ${audioEnabled ? 'text-[oklch(0.99_0_0)]' : 'text-[oklch(0.40_0_0)]'} hover:text-[oklch(0.99_0_0)] transition-colors`}
                    title="Enable Audio Reactivity"
                >
                    {audioEnabled ? <Activity className="w-4 h-4" /> : <Activity className="w-4 h-4 opacity-50" />}
                </button>
                
                <button
                    onClick={toggleVoiceSession}
                    className={`flex items-center gap-2 text-sm ${voiceSession.state.isRecording ? 'text-red-500 animate-pulse' : voiceSession.state.isProcessing ? 'text-blue-400' : 'text-[oklch(0.40_0_0)]'} hover:text-[oklch(0.99_0_0)] transition-colors`}
                    title="Talk to Alfred"
                >
                    {voiceSession.state.isSpeaking ? <Volume2 className="w-4 h-4" /> : voiceSession.state.isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
            </div>
            
            {/* Minimal Transcript Display */}
            {(voiceSession.state.transcript || voiceSession.lastResponse?.assistant.text) && (
                <div className="mt-4 p-4 rounded-2xl border border-[oklch(0.20_0_0)] bg-[oklch(0.05_0_0)]/80 backdrop-blur-md max-w-md text-left font-mono">
                    {voiceSession.state.transcript && (
                        <p className="text-[oklch(0.70_0_0)] text-sm mb-2">
                            {'> '} <ScrambleText text={voiceSession.state.transcript} />
                        </p>
                    )}
                    {voiceSession.lastResponse && (
                        <p className="text-[oklch(0.99_0_0)] text-sm">
                            <ScrambleText text={voiceSession.lastResponse.assistant.text} />
                        </p>
                    )}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
