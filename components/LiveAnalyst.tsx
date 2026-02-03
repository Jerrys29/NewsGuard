
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, X, Volume2, Loader2, MessageSquare } from 'lucide-react';
import { Button } from './ui/Button';
import { useAppStore } from '../store';
import { decode, decodeAudioData, encode } from '../utils';

interface LiveAnalystProps {
  onClose: () => void;
}

const LiveAnalyst: React.FC<LiveAnalystProps> = ({ onClose }) => {
  const { news, sentiments } = useAppStore();
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcription, setTranscription] = useState<string[]>([]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const stopSession = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    setIsActive(false);
    setIsConnecting(false);
    for (const source of sourcesRef.current) {
      source.stop();
    }
    sourcesRef.current.clear();
  };

  const startSession = async () => {
    setIsConnecting(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    // Setup Audio Contexts
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (!inputAudioContextRef.current) {
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    }

    const contextSummary = news.map(n => `${n.title} (${n.currency})`).join(", ");
    const sentimentSummary = sentiments.map(s => `${s.pair}: ${s.bias}`).join(", ");

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: async () => {
          setIsActive(true);
          setIsConnecting(false);
          
          // Start Microphone Streaming
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
          const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
          
          scriptProcessor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const int16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              int16[i] = inputData[i] * 32768;
            }
            const base64Data = encode(new Uint8Array(int16.buffer));
            sessionPromise.then(session => {
              session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' } });
            });
          };

          source.connect(scriptProcessor);
          scriptProcessor.connect(inputAudioContextRef.current!.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (base64Audio && audioContextRef.current) {
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContextRef.current.currentTime);
            const buffer = await decodeAudioData(decode(base64Audio), audioContextRef.current, 24000, 1);
            const source = audioContextRef.current.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContextRef.current.destination);
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buffer.duration;
            sourcesRef.current.add(source);
            source.onended = () => sourcesRef.current.delete(source);
          }

          if (message.serverContent?.interrupted) {
            for (const source of sourcesRef.current) source.stop();
            sourcesRef.current.clear();
            nextStartTimeRef.current = 0;
          }

          if (message.serverContent?.outputTranscription) {
            setTranscription(prev => [...prev.slice(-4), message.serverContent!.outputTranscription!.text]);
          }
        },
        onerror: (e) => console.error("Live Error:", e),
        onclose: () => stopSession(),
      },
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: `You are the News Guard AI Analyst. 
        Current Context: ${contextSummary}. 
        Sentiments: ${sentimentSummary}.
        Your goal is to provide traders with verbal analysis of the day's macro risks. 
        Be concise, professional, and focus on volatility and 'No-Trade' warnings. 
        Never provide direct financial advice, only volatility risk analysis.`,
        outputAudioTranscription: {},
      },
    });

    sessionRef.current = await sessionPromise;
  };

  useEffect(() => {
    return () => stopSession();
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[3rem] overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-500">
              <MessageSquare size={22} />
            </div>
            <div>
              <h3 className="font-black text-xs uppercase tracking-widest">Live Desk Analyst</h3>
              <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest flex items-center gap-1">
                {isActive ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Connected</> : "Ready to connect"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={20} />
          </button>
        </div>

        <div className="p-10 flex flex-col items-center justify-center space-y-8 min-h-[300px]">
          <div className="relative">
            <div className={`w-32 h-32 rounded-full border-4 border-sky-500/20 flex items-center justify-center transition-all duration-500 ${isActive ? 'scale-110 border-sky-500/40 shadow-[0_0_50px_rgba(14,165,233,0.2)]' : ''}`}>
              {isActive ? (
                <div className="flex gap-1 items-center">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div 
                      key={i} 
                      className="w-1.5 bg-sky-500 rounded-full animate-pulse" 
                      style={{ height: `${Math.random() * 40 + 20}px`, animationDelay: `${i * 0.1}s` }} 
                    />
                  ))}
                </div>
              ) : (
                <Mic size={48} className="text-slate-300" />
              )}
            </div>
            {isConnecting && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 size={48} className="text-sky-500 animate-spin" />
              </div>
            )}
          </div>

          <div className="text-center space-y-2">
            <h4 className="text-lg font-bold">{isActive ? "Analyst Listening..." : "Start Voice Consultation"}</h4>
            <p className="text-sm text-slate-500 px-4">Discuss the day's high-impact events and your sentiment outlook in real-time.</p>
          </div>

          <div className="w-full bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl h-20 overflow-hidden text-xs text-slate-400 font-medium italic text-center">
            {transcription.length > 0 ? transcription.join(' ') : "Transcript will appear here..."}
          </div>

          {!isActive ? (
            <Button variant="primary" size="lg" fullWidth onClick={startSession} disabled={isConnecting}>
              <Mic size={20} className="mr-2" />
              Connect with Analyst
            </Button>
          ) : (
            <Button variant="danger" size="lg" fullWidth onClick={stopSession}>
              <MicOff size={20} className="mr-2" />
              End Session
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveAnalyst;
