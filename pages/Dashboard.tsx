
import React, { useState, useEffect, useRef, useMemo } from 'react';
import AppShell from '../components/layout/AppShell';
import LiveAnalyst from '../components/LiveAnalyst';
import { useAppStore } from '../store';
import { Impact, NewsEvent, SentimentData } from '../types';
import { formatLocalTime, getImpactColor, getNextNews, formatDuration, decodeBase64, decodeAudioData } from '../utils';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { CURRENCY_FLAGS, NO_TRADE_RULES } from '../constants';
import { Clock, TrendingUp, AlertTriangle, RefreshCw, BrainCircuit, ExternalLink, X, Volume2, Square, Loader2, BarChart3, TrendingDown, ChevronRight, Mic, LayoutDashboard, Target } from 'lucide-react';
import { differenceInSeconds, isPast, getHours } from 'date-fns';
import { fetchLiveNewsWithSearch, getRiskAssessment, generateAudioBriefing, getMarketSentiment, getDailyTradingPlan } from '../services/ai';

const Dashboard: React.FC = () => {
  const { news, sentiments, setSentiments, preferences, toggleImpact, setNews, isSyncing, setIsSyncing, groundingSources } = useAppStore();
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<NewsEvent | null>(null);
  const [assessment, setAssessment] = useState<string | null>(null);
  const [loadingAssessment, setLoadingAssessment] = useState(false);
  const [isLiveModalOpen, setIsLiveModalOpen] = useState(false);
  
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [isPlayingBriefing, setIsPlayingBriefing] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const [isPlanOpen, setIsPlanOpen] = useState(false);
  const [tradingPlan, setTradingPlan] = useState<string | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);

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
      const sentimentResult = await getMarketSentiment(result.news, preferences.selectedPairs);
      setSentiments(sentimentResult);
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
  }, [new Date().getHours()]);

  const filteredNews = news.filter(n => preferences.impactFilters.includes(n.impact));

  // Calculate Market Strength Gauge (simple avg of sentiments)
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
        {/* Market Momentum Gauge */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Market Momentum</h3>
              <div className="text-[10px] font-black uppercase tracking-widest text-sky-500">Live Pulse</div>
            </div>
            <div className="flex items-center gap-6">
              <div className="relative w-24 h-12 overflow-hidden">
                <div className="absolute top-0 left-0 w-24 h-24 rounded-full border-[10px] border-slate-100 dark:border-slate-800" />
                <div 
                  className="absolute top-0 left-0 w-24 h-24 rounded-full border-[10px] border-sky-500 border-b-transparent border-r-transparent transition-all duration-1000 ease-out"
                  style={{ transform: `rotate(${ (marketStrength / 100) * 180 - 45 }deg)` }}
                />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-lg font-black">{Math.round(marketStrength)}%</div>
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-500 mb-1">
                  Current overall market bias is <span className={marketStrength > 50 ? 'text-emerald-500' : 'text-red-500'}>{marketStrength > 55 ? 'Bullish' : marketStrength < 45 ? 'Bearish' : 'Consolidating'}</span>.
                </p>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                   <div className="h-full bg-sky-500" style={{ width: `${marketStrength}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Trade Strategy</h3>
              <Target size={16} className="text-sky-500" />
            </div>
            <p className="text-xs font-medium text-slate-500 py-2">Get an AI-generated trading plan for the next 24 hours based on news and sentiment.</p>
            <Button variant="secondary" size="sm" fullWidth onClick={fetchTradingPlan}>
              Generate Plan
            </Button>
          </div>
        </div>

        {/* Session Tracker */}
        <div className="flex gap-2 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
          {marketSessions.map(session => (
            <div key={session.name} className={`flex-1 flex flex-col items-center p-2 rounded-xl transition-all ${session.active ? 'bg-emerald-500/10 text-emerald-600' : 'opacity-30'}`}>
              <span className="text-[8px] font-black uppercase tracking-tighter">{session.name}</span>
              <div className={`w-1 h-1 rounded-full mt-1 ${session.active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            </div>
          ))}
        </div>

        {/* Market Bias Pulse */}
        {sentiments.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">AI Market Bias</h3>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
              {sentiments.map((s, i) => (
                <div key={i} className="flex-shrink-0 w-40 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold">{s.pair}</span>
                    {s.bias === 'BULLISH' ? <TrendingUp size={14} className="text-emerald-500" /> : s.bias === 'BEARISH' ? <TrendingDown size={14} className="text-red-500" /> : <BarChart3 size={14} className="text-slate-400" />}
                  </div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="flex-1 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${s.bias === 'BULLISH' ? 'bg-emerald-500' : s.bias === 'BEARISH' ? 'bg-red-500' : 'bg-slate-400'}`} 
                        style={{ width: `${s.score}%` }} 
                      />
                    </div>
                    <span className="text-[10px] font-black tabular-nums">{s.score}%</span>
                  </div>
                  <p className="text-[9px] text-slate-400 leading-tight line-clamp-2">{s.reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dashboard Actions */}
        <div className="flex justify-between items-center bg-white dark:bg-slate-900/50 p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex gap-2">
            <Button 
              variant="primary" 
              size="sm" 
              onClick={() => setIsLiveModalOpen(true)}
              className="h-9 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"
            >
              <Mic size={14} className="mr-2" />
              <span className="text-xs font-bold">Voice Analyst</span>
            </Button>
            <Button 
              variant={isPlayingBriefing ? "danger" : "secondary"} 
              size="sm" 
              onClick={handleAudioBriefing} 
              disabled={isBriefingLoading}
              className="h-9 px-4 rounded-xl"
            >
              {isBriefingLoading ? <Loader2 size={14} className="animate-spin mr-2" /> : isPlayingBriefing ? <Square size={14} className="mr-2" /> : <Volume2 size={14} className="mr-2" />}
              <span className="text-xs font-bold tracking-tight">Briefing</span>
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSync} disabled={isSyncing} className="h-9 px-4 text-slate-500">
            <RefreshCw size={14} className={`mr-2 ${isSyncing ? "animate-spin" : ""}`} />
            <span className="text-xs font-bold">Refresh</span>
          </Button>
        </div>

        {/* Major Warnings */}
        {isNoTradeDay && (
          <div className="p-4 rounded-3xl bg-red-500/10 border-2 border-red-500/20 flex gap-4 items-center">
            <div className="w-12 h-12 rounded-2xl bg-red-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-red-500/30 animate-pulse">
              <AlertTriangle size={28} />
            </div>
            <div>
              <h3 className="font-black text-red-600 dark:text-red-400 text-xs tracking-widest uppercase">No-Trade Environment</h3>
              <p className="text-xs text-red-600/70 dark:text-red-400/70 font-medium">Critical events match your protection rules. Stay cautious.</p>
            </div>
          </div>
        )}

        {/* Next Countdown */}
        {nextNews && (
          <div className="relative glass p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl shadow-slate-200/20 dark:shadow-none group overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-10 transition-opacity">
              <BrainCircuit size={140} />
            </div>
            <div className="flex justify-between items-center mb-6 relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Live Counter</span>
              </div>
              <Badge variant={nextNews.impact === Impact.HIGH ? 'danger' : 'warning'}>{nextNews.impact} Impact</Badge>
            </div>
            <div className="text-center space-y-2 relative z-10 pb-6">
              <p className="text-6xl md:text-7xl font-mono font-bold tracking-tighter text-slate-900 dark:text-white tabular-nums">
                {timeLeft !== null ? formatDuration(timeLeft) : '00 : 00 : 00'}
              </p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl leading-none">{CURRENCY_FLAGS[nextNews.currency]}</span>
                <p className="font-black text-2xl tracking-tight leading-none">{nextNews.title}</p>
              </div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Release: {formatLocalTime(new Date(nextNews.time), preferences.timezone)}</p>
            </div>
            <Button 
              variant="primary" 
              size="lg" 
              fullWidth 
              className="relative z-10 py-4 bg-sky-500 rounded-2xl shadow-xl shadow-sky-500/20"
              onClick={() => openAssessment(nextNews)}
            >
              <BrainCircuit size={20} className="mr-2" />
              Analyze Risk Data
            </Button>
          </div>
        )}

        {/* Filter Controls */}
        <div className="flex gap-2 bg-slate-100 dark:bg-slate-900/50 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
          {[Impact.HIGH, Impact.MEDIUM, Impact.LOW].map(impact => (
            <button
              key={impact}
              onClick={() => toggleImpact(impact)}
              className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                preferences.impactFilters.includes(impact)
                  ? getImpactColor(impact)
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              {impact}
            </button>
          ))}
        </div>

        {/* News Feed */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-black text-xs uppercase tracking-[0.2em] text-slate-400">Chronological Feed</h2>
            <div className="flex items-center gap-1.5 text-slate-300 text-[9px] font-black uppercase">
              <Clock size={10} />
              <span>{preferences.timezone}</span>
            </div>
          </div>

          <div className="space-y-2.5">
            {filteredNews.length === 0 ? (
              <div className="py-20 text-center space-y-4 opacity-40">
                <TrendingUp size={48} className="mx-auto text-slate-200" />
                <p className="text-[10px] font-black uppercase tracking-widest">No matching events detected</p>
              </div>
            ) : (
              filteredNews.sort((a,b) => new Date(a.time).getTime() - new Date(b.time).getTime()).map(n => (
                <div 
                  key={n.id} 
                  onClick={() => openAssessment(n)}
                  className={`p-4 rounded-3xl border transition-all flex justify-between items-center group cursor-pointer ${
                    isPast(new Date(n.time)) 
                    ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-30 scale-95' 
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-500/50 hover:shadow-lg shadow-slate-200/50'
                  }`}
                >
                  <div className="flex gap-4 items-center">
                    <div className={`w-14 h-14 rounded-2xl border-2 flex flex-col items-center justify-center font-mono font-bold leading-tight shrink-0 group-hover:scale-105 transition-transform ${getImpactColor(n.impact)}`}>
                      <span className="text-[10px] opacity-60 mb-0.5 uppercase tracking-tighter">{n.currency}</span>
                      <span className="text-base tracking-tighter">{formatLocalTime(new Date(n.time), preferences.timezone)}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl leading-none grayscale-[0.3]">{CURRENCY_FLAGS[n.currency]}</span>
                        <h4 className="font-bold text-sm tracking-tight group-hover:text-sky-500 transition-colors">{n.title}</h4>
                      </div>
                      <div className="flex gap-3 text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest">
                        <span className="flex items-center gap-1">PRV: <span className="text-slate-600 dark:text-slate-300">{n.previous || '-'}</span></span>
                        <span className="flex items-center gap-1">FCT: <span className="text-slate-600 dark:text-slate-300">{n.forecast || '-'}</span></span>
                      </div>
                    </div>
                  </div>
                  {!isPast(new Date(n.time)) && (
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-sky-500 group-hover:translate-x-1 transition-all" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Source Citations */}
        {groundingSources.length > 0 && (
          <div className="pt-8 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Verified Intelligence Sources</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {groundingSources.map((chunk, i) => (
                chunk.web && (
                  <a 
                    key={i} 
                    href={chunk.web.uri} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-emerald-500/30 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <ExternalLink size={14} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 group-hover:text-emerald-500 transition-colors truncate max-w-[150px]">{chunk.web.title || "Intelligence Data"}</span>
                    </div>
                    <span className="text-[8px] font-black uppercase text-slate-300">Grounding v3</span>
                  </a>
                )
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Trading Plan Modal */}
      {isPlanOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500 border border-slate-200 dark:border-slate-800">
             <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Target className="text-sky-500" size={24} />
                <h3 className="font-black text-sm uppercase tracking-widest">Daily Trading Plan</h3>
              </div>
              <button onClick={() => setIsPlanOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={20} />
              </button>
            </div>
            <div className="p-8 max-h-[70vh] overflow-y-auto no-scrollbar">
              {isLoadingPlan ? (
                <div className="py-20 flex flex-col items-center gap-4">
                  <Loader2 className="animate-spin text-sky-500" size={40} />
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Synthesizing Strategy...</p>
                </div>
              ) : (
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  <div className="text-sm leading-relaxed font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-6 rounded-[2.5rem] whitespace-pre-wrap">
                    {tradingPlan}
                  </div>
                </div>
              )}
            </div>
             <div className="p-6 border-t border-slate-100 dark:border-slate-800">
              <Button variant="primary" size="lg" fullWidth onClick={() => setIsPlanOpen(false)}>
                Acknowledge Strategy
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[3rem] overflow-hidden shadow-[0_0_80px_-20px_rgba(14,165,233,0.3)] animate-in slide-in-from-bottom-20 duration-500 border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/30 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-500">
                  <BrainCircuit size={22} />
                </div>
                <div>
                  <h3 className="font-black text-xs uppercase tracking-widest">Market Intelligence</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gemini Analyst v2.5</p>
                </div>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="p-3 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto no-scrollbar">
              <div className="flex items-start gap-6">
                <div className={`w-20 h-20 rounded-[2rem] border-4 flex items-center justify-center text-4xl shrink-0 shadow-inner ${getImpactColor(selectedEvent.impact)}`}>
                  {CURRENCY_FLAGS[selectedEvent.currency]}
                </div>
                <div className="pt-2">
                  <h2 className="text-3xl font-black tracking-tighter leading-none mb-2">{selectedEvent.title}</h2>
                  <div className="flex items-center gap-2">
                    <Badge variant={selectedEvent.impact === Impact.HIGH ? 'danger' : 'warning'}>{selectedEvent.impact} VOLATILITY</Badge>
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{selectedEvent.currency} · {formatLocalTime(new Date(selectedEvent.time), preferences.timezone)}</span>
                  </div>
                </div>
              </div>

              {loadingAssessment ? (
                <div className="py-12 flex flex-col items-center gap-6">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-4 border-sky-500/20" />
                    <div className="absolute inset-0 rounded-full border-4 border-sky-500 border-t-transparent animate-spin" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Scanning Historical Correlation Data...</p>
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-950 p-7 rounded-[2.5rem] border border-slate-100 dark:border-slate-800">
                  <div className="prose prose-slate dark:prose-invert max-w-none">
                    <div className="text-sm leading-relaxed font-bold text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                      {assessment}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-8 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
              <Button variant="primary" size="lg" fullWidth onClick={() => setSelectedEvent(null)} className="rounded-2xl py-5 shadow-2xl shadow-sky-500/20">
                Finalize Strategy
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
