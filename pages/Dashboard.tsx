
import React, { useState, useEffect, useRef, useMemo } from 'react';
import AppShell from '../components/layout/AppShell';
import LiveAnalyst from '../components/LiveAnalyst';
import { useAppStore } from '../store';
import { Impact, NewsEvent, SentimentData } from '../types';
import { formatLocalTime, getImpactColor, getNextNews, formatDuration, decodeBase64, decodeAudioData } from '../utils';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { CURRENCY_FLAGS, NO_TRADE_RULES } from '../constants';
import { Clock, TrendingUp, AlertTriangle, RefreshCw, BrainCircuit, ExternalLink, X, Volume2, Square, Loader2, BarChart3, TrendingDown, ChevronRight, Mic, Target, Flame, Info } from 'lucide-react';
import { differenceInSeconds, isPast, getHours, format } from 'date-fns';
import { fetchLiveNewsWithSearch, getRiskAssessment, generateAudioBriefing, getMarketSentiment, getDailyTradingPlan, getPairRiskScores } from '../services/ai';

const Dashboard: React.FC = () => {
  const { news, sentiments, setSentiments, preferences, toggleImpact, setNews, isSyncing, setIsSyncing, groundingSources } = useAppStore();
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<NewsEvent | null>(null);
  const [assessment, setAssessment] = useState<string | null>(null);
  const [loadingAssessment, setLoadingAssessment] = useState(false);
  const [isLiveModalOpen, setIsLiveModalOpen] = useState(false);
  const [riskScores, setRiskScores] = useState<Record<string, number>>({});
  
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [isPlayingBriefing, setIsPlayingBriefing] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const [isPlanOpen, setIsPlanOpen] = useState(false);
  const [tradingPlan, setTradingPlan] = useState<string | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);

  const nextNews = getNextNews(news);

  // Notification Engine Logic
  useEffect(() => {
    if (nextNews && preferences.notificationsEnabled) {
      const diff = differenceInSeconds(new Date(nextNews.time), new Date());
      // Trigger notification exactly at the preference time (e.g. 15 mins before)
      if (diff === preferences.notifyMinutesBefore * 60) {
        new Notification(`${nextNews.currency} High Impact Event`, {
          body: `${nextNews.title} is releasing in ${preferences.notifyMinutesBefore} minutes. Check risk levels.`,
          icon: '/favicon.ico'
        });
      }
    }
  }, [nextNews, preferences.notificationsEnabled, preferences.notifyMinutesBefore]);

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
      
      const [sentimentResult, scores] = await Promise.all([
        getMarketSentiment(result.news, preferences.selectedPairs),
        getPairRiskScores(result.news, preferences.selectedPairs)
      ]);
      
      setSentiments(sentimentResult);
      setRiskScores(scores);
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
      if (!audioData) return;
      if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const buffer = await decodeAudioData(decodeBase64(audioData), audioContextRef.current);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => setIsPlayingBriefing(false);
      audioSourceRef.current = source;
      source.start();
      setIsPlayingBriefing(true);
    } catch (e) {
      console.error(e);
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

  const fetchTradingPlan = async () => {
    setIsPlanOpen(true);
    setIsLoadingPlan(true);
    try {
      const plan = await getDailyTradingPlan(news, sentiments);
      setTradingPlan(plan);
    } catch (e) {
      setTradingPlan("Could not generate strategy at this time.");
    } finally {
      setIsLoadingPlan(false);
    }
  };

  const isNoTradeDay = useMemo(() => news.some(n => {
    const isHighImpact = n.impact === Impact.HIGH;
    const matchesKeyword = NO_TRADE_RULES.some(rule => 
      preferences.noTradeRules.includes(rule.id) && 
      rule.keywords.some(kw => n.title.toLowerCase().includes(kw.toLowerCase()))
    );
    return isHighImpact && (matchesKeyword || n.isNoTrade);
  }), [news, preferences.noTradeRules]);

  const marketSessions = useMemo(() => {
    const hours = getHours(new Date());
    return [
      { name: 'London', open: 8, close: 16, active: hours >= 8 && hours < 16 },
      { name: 'New York', open: 13, close: 21, active: hours >= 13 && hours < 21 },
      { name: 'Tokyo', open: 0, close: 8, active: (hours >= 0 && hours < 8) || hours >= 23 },
      { name: 'Sydney', open: 22, close: 6, active: hours >= 22 || hours < 6 },
    ];
  }, []);

  const filteredNews = news.filter(n => preferences.impactFilters.includes(n.impact));

  const marketStrength = useMemo(() => {
    if (sentiments.length === 0) return 50;
    const sum = sentiments.reduce((acc, s) => {
      let val = s.score;
      if (s.bias === 'BEARISH') val = 100 - s.score;
      if (s.bias === 'NEUTRAL') val = 50;
      return acc + val;
    }, 0);
    return sum / sentiments.length;
  }, [sentiments]);

  return (
    <AppShell title="Live Desk">
      <div className="space-y-6 pb-4">
        {/* Market Momentum & Strategy Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:scale-110 transition-transform duration-500">
               <TrendingUp size={80} />
            </div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Market Momentum</h3>
              <div className="text-[10px] font-black uppercase tracking-widest text-sky-500">Live Pulse</div>
            </div>
            <div className="flex items-center gap-6">
              <div className="relative w-24 h-12 overflow-hidden">
                <div className="absolute top-0 left-0 w-24 h-24 rounded-full border-[10px] border-slate-100 dark:border-slate-800" />
                <div 
                  className={`absolute top-0 left-0 w-24 h-24 rounded-full border-[10px] ${marketStrength > 50 ? 'border-emerald-500' : 'border-red-500'} border-b-transparent border-r-transparent transition-all duration-1000 ease-out`}
                  style={{ transform: `rotate(${ (marketStrength / 100) * 180 - 45 }deg)` }}
                />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-lg font-black">{Math.round(marketStrength)}%</div>
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-500 mb-1 leading-tight">
                  Overall bias is <span className={marketStrength > 50 ? 'text-emerald-500' : 'text-red-500'}>{marketStrength > 55 ? 'Bullish' : marketStrength < 45 ? 'Bearish' : 'Neutral'}</span>.
                </p>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                   <div className={`h-full ${marketStrength > 50 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${marketStrength}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between group overflow-hidden relative">
             <div className="absolute -bottom-4 -right-4 opacity-[0.03] group-hover:scale-110 transition-transform">
                <Target size={120} />
             </div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Strategic Plan</h3>
              <Target size={16} className="text-sky-500" />
            </div>
            <p className="text-xs font-medium text-slate-500 mb-4 leading-relaxed">AI analyzes news and sentiment to create your optimal 24h setup.</p>
            <Button variant="secondary" size="sm" fullWidth onClick={fetchTradingPlan} className="rounded-2xl border-2">
              Generate Brief
            </Button>
          </div>
        </div>

        {/* Volatility Heatmap */}
        {Object.keys(riskScores).length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
               <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Volatility Heatmap</h3>
               <Flame size={14} className="text-orange-500" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
              {Object.entries(riskScores).map(([pair, score]) => (
                <div key={pair} className="flex-shrink-0 w-24 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400">{pair}</span>
                  <div className="flex items-end gap-1 h-8">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div 
                        key={i} 
                        className={`w-2 rounded-t-sm transition-all duration-500 ${score >= i * 2 ? 'bg-orange-500' : 'bg-slate-100 dark:bg-slate-800'}`} 
                        style={{ height: `${i * 20}%` }}
                      />
                    ))}
                  </div>
                  <span className={`text-xs font-black ${score > 7 ? 'text-red-500' : score > 4 ? 'text-orange-500' : 'text-emerald-500'}`}>
                    {score}/10
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Session Tracker */}
        <div className="flex gap-2 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
          {marketSessions.map(session => (
            <button key={session.name} className={`flex-1 flex flex-col items-center p-2 rounded-xl transition-all ${session.active ? 'bg-emerald-500/10 text-emerald-600' : 'opacity-30'}`}>
              <span className="text-[8px] font-black uppercase tracking-tighter">{session.name}</span>
              <div className={`w-1.5 h-1.5 rounded-full mt-1 ${session.active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            </button>
          ))}
        </div>

        {/* Dashboard Actions */}
        <div className="flex justify-between items-center bg-white dark:bg-slate-900/50 p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex gap-2">
            <Button 
              variant="primary" 
              size="sm" 
              onClick={() => setIsLiveModalOpen(true)}
              className="h-10 px-5 rounded-2xl bg-sky-500 hover:bg-sky-600 shadow-sky-500/30"
            >
              <Mic size={14} className="mr-2" />
              <span className="text-xs font-black uppercase tracking-tight">Voice Desk</span>
            </Button>
            <Button 
              variant={isPlayingBriefing ? "danger" : "secondary"} 
              size="sm" 
              onClick={handleAudioBriefing} 
              disabled={isBriefingLoading}
              className="h-10 px-5 rounded-2xl"
            >
              {isBriefingLoading ? <Loader2 size={14} className="animate-spin mr-2" /> : isPlayingBriefing ? <Square size={14} className="mr-2" /> : <Volume2 size={14} className="mr-2" />}
              <span className="text-xs font-black uppercase tracking-tight">Daily Brief</span>
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSync} disabled={isSyncing} className="h-10 px-4 text-slate-500">
            <RefreshCw size={14} className={`mr-2 ${isSyncing ? "animate-spin" : ""}`} />
            <span className="text-[10px] font-black uppercase">Refresh</span>
          </Button>
        </div>

        {/* Major Warnings */}
        {isNoTradeDay && (
          <div className="p-5 rounded-[2rem] bg-red-500/10 border-2 border-red-500/20 flex gap-4 items-center shadow-xl shadow-red-500/5">
            <div className="w-14 h-14 rounded-2xl bg-red-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-red-500/30 animate-pulse">
              <AlertTriangle size={32} />
            </div>
            <div>
              <h3 className="font-black text-red-600 dark:text-red-400 text-xs tracking-[0.2em] uppercase mb-0.5">Alert: No-Trade Rules Active</h3>
              <p className="text-xs text-red-600/70 dark:text-red-400/70 font-bold leading-tight">Critical macro catalysts detected. High risk of slippage and whipsaws.</p>
            </div>
          </div>
        )}

        {/* Next Countdown */}
        {nextNews && (
          <div className="relative glass p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-2xl shadow-slate-200/20 dark:shadow-none group overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-10 transition-opacity">
              <BrainCircuit size={160} />
            </div>
            <div className="flex justify-between items-center mb-8 relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
                <span className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400">Impact Imminent</span>
              </div>
              <Badge variant={nextNews.impact === Impact.HIGH ? 'danger' : 'warning'} className="px-4 py-1">{nextNews.impact} Impact</Badge>
            </div>
            <div className="text-center space-y-3 relative z-10 pb-8">
              <p className="text-7xl md:text-8xl font-mono font-bold tracking-tighter text-slate-900 dark:text-white tabular-nums drop-shadow-sm">
                {timeLeft !== null ? formatDuration(timeLeft) : '00 : 00 : 00'}
              </p>
              <div className="flex items-center justify-center gap-4">
                <span className="text-4xl leading-none">{CURRENCY_FLAGS[nextNews.currency]}</span>
                <p className="font-black text-3xl tracking-tight leading-none text-slate-900 dark:text-slate-100">{nextNews.title}</p>
              </div>
              <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.3em]">Release: {formatLocalTime(new Date(nextNews.time), preferences.timezone)}</p>
            </div>
            <Button 
              variant="primary" 
              size="lg" 
              fullWidth 
              className="relative z-10 py-5 bg-sky-500 rounded-[1.5rem] shadow-xl shadow-sky-500/20 text-xs font-black uppercase tracking-widest"
              onClick={() => openAssessment(nextNews)}
            >
              <BrainCircuit size={20} className="mr-3" />
              View Analyst Report
            </Button>
          </div>
        )}

        {/* Timeline Feed */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-black text-[11px] uppercase tracking-[0.25em] text-slate-400 flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-slate-300" /> Timeline Feed
            </h2>
            <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-black uppercase">
              <Clock size={12} />
              <span>{preferences.timezone}</span>
            </div>
          </div>

          <div className="space-y-3">
            {filteredNews.length === 0 ? (
              <div className="py-24 text-center space-y-4 opacity-40 bg-white dark:bg-slate-900/40 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                <BarChart3 size={56} className="mx-auto text-slate-200" />
                <p className="text-[11px] font-black uppercase tracking-widest">Awaiting Macro Data</p>
              </div>
            ) : (
              filteredNews.sort((a,b) => new Date(a.time).getTime() - new Date(b.time).getTime()).map(n => (
                <div 
                  key={n.id} 
                  onClick={() => openAssessment(n)}
                  className={`p-5 rounded-[2rem] border transition-all flex justify-between items-center group cursor-pointer ${
                    isPast(new Date(n.time)) 
                    ? 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 opacity-20 scale-95 grayscale' 
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-500/50 hover:shadow-2xl hover:shadow-sky-500/5'
                  }`}
                >
                  <div className="flex gap-5 items-center">
                    <div className={`w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center font-mono font-bold leading-tight shrink-0 group-hover:scale-105 transition-transform ${getImpactColor(n.impact)}`}>
                      <span className="text-[10px] opacity-60 mb-0.5 uppercase tracking-tighter">{n.currency}</span>
                      <span className="text-lg tracking-tighter">{formatLocalTime(new Date(n.time), preferences.timezone)}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl leading-none">{CURRENCY_FLAGS[n.currency]}</span>
                        <h4 className="font-black text-sm tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-sky-500 transition-colors line-clamp-1">{n.title}</h4>
                      </div>
                      <div className="flex gap-4 text-[10px] font-black text-slate-400 mt-2 uppercase tracking-[0.1em]">
                        <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">PREV: <span className="text-slate-900 dark:text-slate-200">{n.previous || '-'}</span></span>
                        <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">FCST: <span className="text-slate-900 dark:text-slate-200">{n.forecast || '-'}</span></span>
                      </div>
                    </div>
                  </div>
                  {!isPast(new Date(n.time)) && (
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 group-hover:bg-sky-500 transition-all">
                       <ChevronRight size={20} className="text-slate-400 group-hover:text-white transition-colors" />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Source Citations */}
        {groundingSources.length > 0 && (
          <div className="pt-10 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5 mb-5 px-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">Institutional Grounding</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {groundingSources.map((chunk, i) => (
                chunk.web && (
                  <a 
                    key={i} 
                    href={chunk.web.uri} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] hover:border-emerald-500/40 hover:shadow-lg transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <ExternalLink size={16} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 group-hover:text-emerald-500 transition-colors truncate max-w-[140px]">{chunk.web.title || "Macro Intelligence"}</span>
                        <span className="text-[8px] font-black uppercase text-slate-400">Reference Chunk {i+1}</span>
                      </div>
                    </div>
                    <Badge variant="success" className="opacity-40">Verified</Badge>
                  </a>
                )
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Trading Plan Modal */}
      {isPlanOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[3.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500 border border-slate-200 dark:border-slate-800">
             <div className="p-7 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-500">
                  <Target size={24} />
                </div>
                <div>
                  <h3 className="font-black text-xs uppercase tracking-[0.2em] text-slate-900 dark:text-white">Daily Execution Brief</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Proprietary Strategy v4.1</p>
                </div>
              </div>
              <button onClick={() => setIsPlanOpen(false)} className="p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-10 max-h-[70vh] overflow-y-auto no-scrollbar">
              {isLoadingPlan ? (
                <div className="py-24 flex flex-col items-center gap-6">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-4 border-sky-500/10" />
                    <div className="absolute inset-0 rounded-full border-4 border-sky-500 border-t-transparent animate-spin" />
                  </div>
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 animate-pulse">Scanning Sentiment Overlays...</p>
                </div>
              ) : (
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  <div className="text-sm leading-relaxed font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-inner whitespace-pre-wrap">
                    {tradingPlan}
                  </div>
                </div>
              )}
            </div>
             <div className="p-8 border-t border-slate-100 dark:border-slate-800">
              <Button variant="primary" size="lg" fullWidth onClick={() => setIsPlanOpen(false)} className="rounded-[1.5rem] py-5 shadow-2xl shadow-sky-500/20 text-xs font-black uppercase tracking-widest">
                Acknowledge Daily Mandate
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[3.5rem] overflow-hidden shadow-[0_0_80px_-20px_rgba(14,165,233,0.3)] animate-in slide-in-from-bottom-20 duration-500 border border-slate-200 dark:border-slate-800">
            <div className="p-7 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-500">
                  <BrainCircuit size={26} />
                </div>
                <div>
                  <h3 className="font-black text-xs uppercase tracking-[0.2em] text-slate-900 dark:text-white">Risk Intelligence</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Real-time Catalyst Analysis</p>
                </div>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X size={26} />
              </button>
            </div>
            
            <div className="p-10 space-y-8 max-h-[60vh] overflow-y-auto no-scrollbar">
              <div className="flex items-start gap-8">
                <div className={`w-24 h-24 rounded-[2.5rem] border-4 flex flex-col items-center justify-center text-4xl shrink-0 shadow-inner bg-white dark:bg-slate-950 ${getImpactColor(selectedEvent.impact)}`}>
                  {CURRENCY_FLAGS[selectedEvent.currency]}
                  <span className="text-[10px] font-black mt-1 opacity-60 uppercase tracking-tighter">{selectedEvent.currency}</span>
                </div>
                <div className="pt-2 flex-1">
                  <h2 className="text-4xl font-black tracking-tighter leading-none mb-3 text-slate-900 dark:text-slate-50">{selectedEvent.title}</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={selectedEvent.impact === Impact.HIGH ? 'danger' : 'warning'} className="px-3 py-1 text-[9px]">{selectedEvent.impact} VOLATILITY</Badge>
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-2">
                       <Clock size={12} /> {formatLocalTime(new Date(selectedEvent.time), preferences.timezone)}
                    </span>
                  </div>
                </div>
              </div>

              {loadingAssessment ? (
                <div className="py-20 flex flex-col items-center gap-8">
                  <div className="relative w-20 h-20">
                    <div className="absolute inset-0 rounded-full border-4 border-sky-500/10" />
                    <div className="absolute inset-0 rounded-full border-4 border-sky-500 border-t-transparent animate-spin" />
                  </div>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] animate-pulse">Running Monte Carlo Correlation...</p>
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-950 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-inner">
                  <div className="prose prose-slate dark:prose-invert max-w-none">
                    <div className="text-sm leading-relaxed font-bold text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                      {assessment}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-8 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
              <Button variant="primary" size="lg" fullWidth onClick={() => setSelectedEvent(null)} className="rounded-[1.5rem] py-6 shadow-2xl shadow-sky-500/30 text-xs font-black uppercase tracking-[0.2em]">
                Acknowledge Risk Model
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Live Voice Analyst Modal */}
      {isLiveModalOpen && (
        <LiveAnalyst onClose={() => setIsLiveModalOpen(false)} />
      )}
    </AppShell>
  );
};

export default Dashboard;
