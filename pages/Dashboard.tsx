
import React, { useState, useEffect, useRef } from 'react';
import AppShell from '../components/layout/AppShell';
import { useAppStore } from '../store';
import { Impact, NewsEvent } from '../types';
import { formatLocalTime, getImpactColor, getNextNews, formatDuration, decodeBase64, decodeAudioData } from '../utils';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { CURRENCY_FLAGS } from '../constants';
import { Clock, TrendingUp, AlertTriangle, RefreshCw, BrainCircuit, ExternalLink, X, Volume2, Square, Loader2 } from 'lucide-react';
import { differenceInSeconds, isPast } from 'date-fns';
import { fetchLiveNewsWithSearch, getRiskAssessment, generateAudioBriefing } from '../services/ai';

const Dashboard: React.FC = () => {
  const { news, preferences, toggleImpact, setNews, isSyncing, setIsSyncing, groundingSources } = useAppStore();
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<NewsEvent | null>(null);
  const [assessment, setAssessment] = useState<string | null>(null);
  const [loadingAssessment, setLoadingAssessment] = useState(false);
  
  // Audio State
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [isPlayingBriefing, setIsPlayingBriefing] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const nextNews = getNextNews(news);

  useEffect(() => {
    const timer = setInterval(() => {
      if (nextNews) {
        const diff = differenceInSeconds(new Date(nextNews.time), new Date());
        setTimeLeft(diff > 0 ? diff : 0);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [nextNews]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await fetchLiveNewsWithSearch();
      setNews(result.news, result.sources);
    } catch (e) {
      console.error(e);
      setIsSyncing(false);
    }
  };

  const handleAudioBriefing = async () => {
    if (isPlayingBriefing) {
      audioSourceRef.current?.stop();
      setIsPlayingBriefing(false);
      return;
    }

    setIsBriefingLoading(true);
    try {
      const audioData = await generateAudioBriefing(news);
      if (!audioData) {
        alert("No high-impact events to summarize today.");
        return;
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      const decoded = decodeBase64(audioData);
      const buffer = await decodeAudioData(decoded, audioContextRef.current);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      
      source.onended = () => setIsPlayingBriefing(false);
      
      audioSourceRef.current = source;
      source.start();
      setIsPlayingBriefing(true);
    } catch (e) {
      console.error("Briefing failed", e);
    } finally {
      setIsBriefingLoading(false);
    }
  };

  const openAssessment = async (event: NewsEvent) => {
    setSelectedEvent(event);
    setLoadingAssessment(true);
    setAssessment(null);
    try {
      const res = await getRiskAssessment(event);
      setAssessment(res);
    } catch (e) {
      setAssessment("Failed to load analysis.");
    } finally {
      setLoadingAssessment(false);
    }
  };

  const filteredNews = news.filter(n => preferences.impactFilters.includes(n.impact));
  const isNoTradeDay = news.some(n => n.isNoTrade && preferences.impactFilters.includes(Impact.HIGH));

  return (
    <AppShell title="Dashboard">
      <div className="space-y-6">
        {/* Actions Bar */}
        <div className="flex justify-between items-center bg-white dark:bg-slate-900/50 p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex gap-1">
            <Button 
              variant={isPlayingBriefing ? "danger" : "secondary"} 
              size="sm" 
              onClick={handleAudioBriefing} 
              disabled={isBriefingLoading}
              className="relative"
            >
              {isBriefingLoading ? (
                <Loader2 size={16} className="animate-spin mr-2" />
              ) : isPlayingBriefing ? (
                <Square size={16} className="mr-2" />
              ) : (
                <Volume2 size={16} className="mr-2" />
              )}
              {isPlayingBriefing ? "Stop Briefing" : "Daily Audio Brief"}
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSync} disabled={isSyncing} className="text-slate-500">
            <RefreshCw size={14} className={`mr-2 ${isSyncing ? "animate-spin" : ""}`} />
            Sync Calendar
          </Button>
        </div>

        {/* No-Trade Banner */}
        {isNoTradeDay && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex gap-4 items-start shadow-xl shadow-red-500/5">
            <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-red-500/20">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="font-bold text-red-600 dark:text-red-400 text-sm uppercase tracking-wider">High Risk Day Detected</h3>
              <p className="text-xs text-red-600/80 dark:text-red-400/80 leading-tight">NFP/CPI/FOMC events active. Major slippage risk. Protective measures recommended.</p>
            </div>
          </div>
        )}

        {/* Next News Widget */}
        {nextNews && (
          <div className="glass p-6 rounded-3xl space-y-4 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/20 dark:shadow-none relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-10 transition-opacity">
              <BrainCircuit size={120} />
            </div>
            <div className="flex justify-between items-center relative z-10">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Time to Impact</span>
              <Badge variant={nextNews.impact === Impact.HIGH ? 'danger' : 'warning'}>{nextNews.impact} Impact</Badge>
            </div>
            <div className="text-center space-y-1 relative z-10">
              <p className="text-5xl md:text-6xl font-mono font-bold tracking-tighter text-slate-900 dark:text-white tabular-nums">
                {timeLeft !== null ? formatDuration(timeLeft) : '00 : 00 : 00'}
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <span className="text-2xl">{CURRENCY_FLAGS[nextNews.currency]}</span>
                <p className="font-bold text-xl">{nextNews.title}</p>
              </div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Scheduled: {formatLocalTime(new Date(nextNews.time), preferences.timezone)}</p>
            </div>
            <Button 
              variant="primary" 
              size="md" 
              fullWidth 
              className="relative z-10 bg-sky-500 shadow-lg shadow-sky-500/30"
              onClick={() => openAssessment(nextNews)}
            >
              <BrainCircuit size={18} className="mr-2" />
              Analyze Volatility Risk
            </Button>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
          {[Impact.HIGH, Impact.MEDIUM, Impact.LOW].map(impact => (
            <button
              key={impact}
              onClick={() => toggleImpact(impact)}
              className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all shrink-0 ${
                preferences.impactFilters.includes(impact)
                  ? getImpactColor(impact)
                  : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800'
              }`}
            >
              {impact}
            </button>
          ))}
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight">Today's Timeline</h2>
            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
              <Clock size={12} />
              <span>{preferences.timezone} (UTC)</span>
            </div>
          </div>

          <div className="space-y-3">
            {filteredNews.length === 0 ? (
              <div className="py-16 text-center space-y-4 opacity-50 bg-slate-100 dark:bg-slate-900/30 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                <TrendingUp size={48} className="mx-auto text-slate-300" />
                <p className="text-sm font-bold uppercase tracking-widest">No Events Found</p>
              </div>
            ) : (
              filteredNews.sort((a,b) => new Date(a.time).getTime() - new Date(b.time).getTime()).map(n => (
                <div 
                  key={n.id} 
                  onClick={() => openAssessment(n)}
                  className={`p-4 rounded-2xl border transition-all flex justify-between items-center cursor-pointer hover:scale-[1.01] active:scale-[0.99] group ${
                    isPast(new Date(n.time)) 
                    ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-40 grayscale' 
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'
                  }`}
                >
                  <div className="flex gap-4 items-center">
                    <div className={`w-14 h-14 rounded-2xl border flex flex-col items-center justify-center font-mono font-bold leading-none shrink-0 ${getImpactColor(n.impact)}`}>
                      <span className="text-[10px] opacity-60 mb-1">{n.currency}</span>
                      <span className="text-base">{formatLocalTime(new Date(n.time), preferences.timezone)}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl leading-none">{CURRENCY_FLAGS[n.currency]}</span>
                        <h4 className="font-bold text-sm group-hover:text-sky-500 transition-colors line-clamp-1">{n.title}</h4>
                        {n.isNoTrade && <AlertTriangle size={14} className="text-amber-500" />}
                      </div>
                      <div className="flex gap-3 text-[10px] font-black text-slate-400 mt-1.5 uppercase tracking-widest">
                        <span>PRV: {n.previous || '-'}</span>
                        <span>FCT: {n.forecast || '-'}</span>
                      </div>
                    </div>
                  </div>
                  {!isPast(new Date(n.time)) && (
                    <div className="text-[10px] font-black px-2 py-1 bg-sky-500/10 text-sky-600 rounded-lg whitespace-nowrap tabular-nums">
                      {Math.max(0, Math.floor(differenceInSeconds(new Date(n.time), new Date()) / 60))}M
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Grounding Sources */}
        {groundingSources.length > 0 && (
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Verification Sources</h3>
            <div className="flex flex-wrap gap-2">
              {groundingSources.map((chunk, i) => (
                chunk.web && (
                  <a 
                    key={i} 
                    href={chunk.web.uri} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-bold text-slate-500 hover:text-sky-500 hover:border-sky-500/30 transition-all shadow-sm"
                  >
                    <ExternalLink size={10} />
                    {chunk.web.title?.slice(0, 20) || "Source"}...
                  </a>
                )
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Risk Assessment Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-12 duration-500 border border-slate-200 dark:border-slate-800">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-sky-500/10 flex items-center justify-center text-sky-500">
                  <BrainCircuit size={18} />
                </div>
                <h3 className="font-bold tracking-tight">AI Risk Intelligence</h3>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[65vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center gap-5">
                <div className={`w-16 h-16 rounded-[1.5rem] border-2 flex items-center justify-center text-2xl shrink-0 ${getImpactColor(selectedEvent.impact)} shadow-inner`}>
                  {CURRENCY_FLAGS[selectedEvent.currency]}
                </div>
                <div>
                  <h2 className="text-2xl font-bold leading-tight tracking-tight">{selectedEvent.title}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={selectedEvent.impact === Impact.HIGH ? 'danger' : 'warning'}>{selectedEvent.impact}</Badge>
                    <span className="text-xs text-slate-400 font-bold uppercase">{selectedEvent.currency} · {formatLocalTime(new Date(selectedEvent.time), preferences.timezone)}</span>
                  </div>
                </div>
              </div>

              {loadingAssessment ? (
                <div className="space-y-6 py-10">
                  <div className="space-y-3">
                    <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse w-3/4" />
                    <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse w-full" />
                    <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse w-5/6" />
                  </div>
                  <div className="flex flex-col items-center gap-3 pt-4">
                    <Loader2 size={32} className="text-sky-500 animate-spin" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">Computing Volatility Matrices...</p>
                  </div>
                </div>
              ) : (
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  <div className="text-sm leading-relaxed font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                    {assessment}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
              <Button variant="primary" size="lg" fullWidth onClick={() => setSelectedEvent(null)} className="rounded-2xl">
                Acknowledge Risk
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
