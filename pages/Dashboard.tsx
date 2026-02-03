
import React, { useState, useEffect, useRef, useMemo } from 'react';
import AppShell from '../components/layout/AppShell';
import LiveAnalyst from '../components/LiveAnalyst';
import { useAppStore } from '../store';
import { Impact, NewsEvent, SentimentData } from '../types';
import { formatLocalTime, getImpactColor, getNextNews, formatDuration, decodeBase64, decodeAudioData } from '../utils';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { CURRENCY_FLAGS, NO_TRADE_RULES } from '../constants';
import { Clock, TrendingUp, AlertTriangle, RefreshCw, BrainCircuit, ExternalLink, X, Volume2, Square, Loader2, BarChart3, TrendingDown, ChevronRight, Mic, Target, Flame, Info, Activity } from 'lucide-react';
import { differenceInSeconds, isPast, getHours } from 'date-fns';
import { fetchLiveNewsWithSearch, getRiskAssessment, generateAudioBriefing, getMarketSentiment, getDailyTradingPlan, getPairRiskScores } from '../services/ai';

const Dashboard: React.FC = () => {
  const { news, sentiments, setSentiments, preferences, setNews, isSyncing, setIsSyncing, groundingSources, setRiskScores, riskScores } = useAppStore();
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
    if (isSyncing) return;
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
    } finally {
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
      setAssessment("Expert analysis currently unavailable for this specific event. Consult broader risk model.");
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
      setTradingPlan("Strategic overlay synthesis failed. Please try again in a few minutes.");
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
      { name: 'NY', open: 13, close: 21, active: hours >= 13 && hours < 21 },
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
        {/* Market Health Status Bar */}
        <div className="flex items-center gap-2 px-1">
          <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${isNoTradeDay ? 'bg-red-500' : 'bg-emerald-500'}`} 
              style={{ width: isSyncing ? '30%' : '100%' }} 
            />
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
            {isNoTradeDay ? 'High Risk Environment' : 'Optimal Environment'}
          </span>
        </div>

        {/* Market Momentum & Strategy Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:scale-110 transition-transform duration-500">
               <TrendingUp size={80} />
            </div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bias Intensity</h3>
              <div className="text-[10px] font-black uppercase tracking-widest text-sky-500 flex items-center gap-1">
                <Activity size={12} className="animate-pulse" /> Live
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="relative w-20 h-20 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100 dark:text-slate-800" />
                  <circle 
                    cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="8" fill="transparent" 
                    strokeDasharray={213.6}
                    strokeDashoffset={213.6 - (marketStrength / 100) * 213.6}
                    className={`transition-all duration-1000 ${marketStrength > 50 ? 'text-emerald-500' : 'text-red-500'}`} 
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute text-sm font-black tracking-tighter">{Math.round(marketStrength)}%</div>
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-500 mb-2 leading-tight">
                  Sentiment is <span className={marketStrength > 50 ? 'text-emerald-500' : 'text-red-500'}>{marketStrength > 55 ? 'Bullish' : marketStrength < 45 ? 'Bearish' : 'Neutral'}</span>.
                </p>
                <Badge variant={marketStrength > 50 ? 'success' : 'danger'} className="text-[8px]">Intensity: {marketStrength > 70 || marketStrength < 30 ? 'High' : 'Low'}</Badge>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between group overflow-hidden relative">
             <div className="absolute -bottom-4 -right-4 opacity-[0.03] group-hover:scale-110 transition-transform">
                <Target size={120} />
             </div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Strat-Desk Overlay</h3>
              <Target size={16} className="text-sky-500" />
            </div>
            <p className="text-xs font-medium text-slate-500 mb-4 leading-relaxed">Neural analysis of current volatility and sentiment correlation.</p>
            <Button variant="secondary" size="sm" fullWidth onClick={fetchTradingPlan} className="rounded-xl border-2 py-3">
              Generate Synthesis
            </Button>
          </div>
        </div>

        {/* Volatility Heatmap */}
        {Object.keys(riskScores).length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
               <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Institutional Risk Map</h3>
               <Flame size={14} className="text-orange-500" />
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
              {Object.entries(riskScores).sort((a,b) => b[1] - a[1]).map(([pair, score]) => (
                <div key={pair} className="flex-shrink-0 w-28 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col items-center gap-3 hover:border-orange-500/30 transition-colors">
                  <span className="text-[10px] font-black text-slate-400">{pair}</span>
                  <div className="relative w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${score > 7 ? 'bg-red-500' : score > 4 ? 'bg-orange-500' : 'bg-emerald-500'}`} 
                      style={{ width: `${score * 10}%` }}
                    />
                  </div>
                  <span className={`text-[10px] font-black uppercase ${score > 7 ? 'text-red-500' : score > 4 ? 'text-orange-500' : 'text-emerald-500'}`}>
                    Risk: {score}/10
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Market Session Matrix */}
        <div className="grid grid-cols-4 gap-2 bg-slate-100 dark:bg-slate-950 p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
          {marketSessions.map(session => (
            <div key={session.name} className={`flex flex-col items-center p-2.5 rounded-xl transition-all ${session.active ? 'bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800' : 'opacity-30'}`}>
              <span className={`text-[9px] font-black uppercase tracking-tighter ${session.active ? 'text-sky-500' : 'text-slate-400'}`}>{session.name}</span>
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${session.active ? 'bg-sky-500 animate-pulse' : 'bg-slate-400'}`} />
            </div>
          ))}
        </div>

        {/* Main Dashboard Control */}
        <div className="flex justify-between items-center bg-white dark:bg-slate-900/80 backdrop-blur-sm p-3 rounded-2xl border border-slate-200 dark:border-slate-800 sticky top-[72px] z-40">
          <div className="flex gap-2">
            <Button 
              variant="primary" 
              size="sm" 
              onClick={() => setIsLiveModalOpen(true)}
              className="h-10 px-5 rounded-xl bg-sky-500 hover:bg-sky-600"
            >
              <Mic size={14} className="mr-2" />
              <span className="text-[10px] font-black uppercase tracking-tight">AI Desk</span>
            </Button>
            <Button 
              variant={isPlayingBriefing ? "danger" : "secondary"} 
              size="sm" 
              onClick={handleAudioBriefing} 
              disabled={isBriefingLoading}
              className="h-10 px-5 rounded-xl"
            >
              {isBriefingLoading ? <Loader2 size={14} className="animate-spin mr-2" /> : isPlayingBriefing ? <Square size={14} className="mr-2" /> : <Volume2 size={14} className="mr-2" />}
              <span className="text-[10px] font-black uppercase tracking-tight">Audio Brief</span>
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSync} disabled={isSyncing} className="h-10 px-3 text-slate-500">
            <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
          </Button>
        </div>

        {/* Global Alert Notification */}
        {isNoTradeDay && (
          <div className="p-5 rounded-[2.5rem] bg-red-500/10 border border-red-500/30 flex gap-4 items-center animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="w-12 h-12 rounded-2xl bg-red-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-red-500/20">
              <AlertTriangle size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-black text-red-600 dark:text-red-400 text-[10px] tracking-widest uppercase mb-0.5">Execution Block Active</h3>
              <p className="text-[11px] text-red-600/80 dark:text-red-400/80 font-bold leading-tight">Extreme institutional volatility detected. Maintain capital conservation.</p>
            </div>
          </div>
        )}

        {/* Primary Countdown */}
        {nextNews && (
          <div className="relative glass p-10 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-xl group overflow-hidden">
            <div className="absolute -top-10 -right-10 opacity-[0.05] text-sky-500 group-hover:scale-110 transition-transform duration-1000">
              <Clock size={240} />
            </div>
            <div className="flex justify-between items-center mb-8 relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Release Window</span>
              </div>
              <Badge variant={nextNews.impact === Impact.HIGH ? 'danger' : 'warning'} className="px-4 py-1 text-[9px]">{nextNews.impact} Impact</Badge>
            </div>
            <div className="text-center space-y-4 relative z-10 pb-8">
              <p className="text-7xl md:text-8xl font-mono font-bold tracking-tighter text-slate-900 dark:text-white tabular-nums">
                {timeLeft !== null ? formatDuration(timeLeft) : '00 : 00 : 00'}
              </p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-4xl">{CURRENCY_FLAGS[nextNews.currency]}</span>
                <p className="font-black text-2xl tracking-tighter text-slate-900 dark:text-slate-100">{nextNews.title}</p>
              </div>
            </div>
            <Button 
              variant="primary" 
              size="lg" 
              fullWidth 
              className="relative z-10 py-5 bg-sky-500 rounded-2xl shadow-xl shadow-sky-500/30 text-[10px] font-black uppercase tracking-widest"
              onClick={() => openAssessment(nextNews)}
            >
              <BrainCircuit size={18} className="mr-3" />
              Analyze Catalyst Risk
            </Button>
          </div>
        )}

        {/* News Feed Timeline */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
               <span className="w-1 h-1 rounded-full bg-slate-300" /> Event Stream
            </h2>
            <div className="flex items-center gap-1.5 text-slate-400 text-[9px] font-black uppercase">
              <Clock size={11} /> {preferences.timezone}
            </div>
          </div>

          <div className="space-y-3">
            {filteredNews.length === 0 ? (
              <div className="py-20 text-center space-y-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                <BarChart3 size={40} className="mx-auto text-slate-300" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No Events in Pipeline</p>
              </div>
            ) : (
              filteredNews.sort((a,b) => new Date(a.time).getTime() - new Date(b.time).getTime()).map(n => (
                <div 
                  key={n.id} 
                  onClick={() => openAssessment(n)}
                  className={`p-5 rounded-3xl border transition-all flex justify-between items-center group cursor-pointer ${
                    isPast(new Date(n.time)) 
                    ? 'bg-slate-50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800 opacity-20 scale-[0.98]' 
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-500/40 hover:shadow-lg'
                  }`}
                >
                  <div className="flex gap-4 items-center">
                    <div className={`w-14 h-14 rounded-2xl border flex flex-col items-center justify-center font-mono font-bold shrink-0 transition-transform group-hover:scale-105 ${getImpactColor(n.impact)}`}>
                      <span className="text-[9px] opacity-60 mb-0.5 tracking-tighter">{n.currency}</span>
                      <span className="text-base">{formatLocalTime(new Date(n.time), preferences.timezone)}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl leading-none">{CURRENCY_FLAGS[n.currency]}</span>
                        <h4 className="font-black text-sm tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-sky-500 line-clamp-1">{n.title}</h4>
                      </div>
                      <div className="flex gap-3 text-[9px] font-black text-slate-400 mt-2 uppercase tracking-widest">
                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">FCST: {n.forecast || '-'}</span>
                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">PREV: {n.previous || '-'}</span>
                      </div>
                    </div>
                  </div>
                  {!isPast(new Date(n.time)) && (
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-sky-500 transition-colors" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Intelligence Citations */}
        {groundingSources.length > 0 && (
          <div className="pt-8 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-5 px-1 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Grounded Intelligence Sources
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {groundingSources.map((chunk, i) => (
                chunk.web && (
                  <a 
                    key={i} href={chunk.web.uri} target="_blank" rel="noreferrer"
                    className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-emerald-500/30 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <ExternalLink size={14} className="text-emerald-500" />
                      <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 truncate max-w-[120px]">{chunk.web.title || "Ref Data"}</span>
                    </div>
                    <Badge variant="success" className="opacity-40">Verified</Badge>
                  </a>
                )
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Daily Synthesis Modal */}
      {isPlanOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[3rem] overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800">
             <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Target size={20} className="text-sky-500" />
                <h3 className="font-black text-xs uppercase tracking-widest">Strat-Desk Overlay</h3>
              </div>
              <button onClick={() => setIsPlanOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><X size={20} /></button>
            </div>
            <div className="p-10 max-h-[60vh] overflow-y-auto no-scrollbar">
              {isLoadingPlan ? (
                <div className="py-20 flex flex-col items-center gap-6">
                  <Loader2 size={32} className="text-sky-500 animate-spin" />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Synthesizing Institutional Overlay...</p>
                </div>
              ) : (
                <div className="text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-inner whitespace-pre-wrap">
                  {tradingPlan}
                </div>
              )}
            </div>
             <div className="p-8">
              <Button variant="primary" size="lg" fullWidth onClick={() => setIsPlanOpen(false)} className="rounded-2xl py-4 shadow-xl shadow-sky-500/20 text-[10px] font-black uppercase tracking-widest">
                Acknowledge Daily Mandate
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Intelligence Report Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[3rem] overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-10">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <BrainCircuit size={20} className="text-sky-500" />
                <h3 className="font-black text-xs uppercase tracking-widest">Catalyst Intelligence</h3>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><X size={20} /></button>
            </div>
            
            <div className="p-10 space-y-8 max-h-[60vh] overflow-y-auto no-scrollbar">
              <div className="flex items-center gap-6">
                <div className={`w-20 h-20 rounded-3xl border-2 flex flex-col items-center justify-center text-3xl shrink-0 ${getImpactColor(selectedEvent.impact)}`}>
                  {CURRENCY_FLAGS[selectedEvent.currency]}
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight leading-none mb-2 text-slate-900 dark:text-slate-50">{selectedEvent.title}</h2>
                  <Badge variant={selectedEvent.impact === Impact.HIGH ? 'danger' : 'warning'}>{selectedEvent.impact} VOLATILITY</Badge>
                </div>
              </div>

              {loadingAssessment ? (
                <div className="py-20 flex flex-col items-center gap-6">
                   <Loader2 size={32} className="text-sky-500 animate-spin" />
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Running Volatility Scenarios...</p>
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-950 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                  <div className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-wrap font-medium italic">
                    {assessment}
                  </div>
                </div>
              )}
            </div>

            <div className="p-8">
              <Button variant="primary" size="lg" fullWidth onClick={() => setSelectedEvent(null)} className="rounded-2xl py-4 shadow-xl shadow-sky-500/20 text-[10px] font-black uppercase tracking-widest">
                Acknowledge Risk Report
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Voice Consultation Analyst */}
      {isLiveModalOpen && (
        <LiveAnalyst onClose={() => setIsLiveModalOpen(false)} />
      )}
    </AppShell>
  );
};

export default Dashboard;
