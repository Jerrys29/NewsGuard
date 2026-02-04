
import React, { useState, useEffect, useRef, useMemo } from 'react';
import AppShell from '../components/layout/AppShell';
import LiveAnalyst from '../components/LiveAnalyst';
import { useAppStore } from '../store';
import { Impact, NewsEvent } from '../types';
import { formatLocalTime, getImpactColor, getNextNews, decodeBase64, decodeAudioData, t } from '../utils';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { CURRENCY_FLAGS, NO_TRADE_RULES } from '../constants';
import { Activity, Sparkles, Target, BrainCircuit, Flame, Mic, Volume2, Square, Loader2, RefreshCw, ChevronRight, ExternalLink, X } from 'lucide-react';
import { differenceInSeconds, isPast, getHours } from 'date-fns';
import { fetchLiveNewsWithSearch, getRiskAssessment, generateAudioBriefing, getMarketSentiment, getDailyTradingPlan, getPairRiskScores, getTradeOfTheDay } from '../services/ai';

const Dashboard: React.FC = () => {
  const { 
    news, sentiments, setSentiments, preferences, setNews, 
    isSyncing, setIsSyncing, groundingSources, setRiskScores, 
    riskScores, tradeOfTheDay, setTradeOfTheDay 
  } = useAppStore();

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
      
      const pairs = preferences.selectedPairs;
      const [sentimentResult, scores, tradeResult] = await Promise.all([
        getMarketSentiment(result.news, pairs),
        getPairRiskScores(result.news, pairs),
        getTradeOfTheDay(result.news, [])
      ]);
      
      setSentiments(sentimentResult);
      setRiskScores(scores);
      setTradeOfTheDay(tradeResult);
    } catch (e) {
      console.error("Sync Error:", e);
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
      console.error("Briefing Error:", e);
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
      setAssessment("Expert report unavailable. Contact system admin.");
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
      setTradingPlan("Failed to synthesize strategic overlay.");
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
    <AppShell title="Terminal">
      <div className="space-y-6 pb-10">
        {/* Status Bar */}
        <div className="flex items-center gap-3 px-1">
          <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${isNoTradeDay ? 'bg-red-500' : 'bg-emerald-500'}`} 
              style={{ width: isSyncing ? '50%' : '100%' }} 
            />
          </div>
          <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isNoTradeDay ? 'text-red-500' : 'text-emerald-500'}`}>
            {isNoTradeDay ? t('risk_restricted', preferences.language) : t('optimal_liquidity', preferences.language)}
          </span>
        </div>

        {/* Trade of the Day (Neural Pick) */}
        {tradeOfTheDay && (
          <div className="bg-gradient-to-br from-amber-400/20 via-orange-500/10 to-transparent border border-amber-500/30 rounded-[2.5rem] p-8 relative overflow-hidden group shadow-xl">
            <div className="absolute top-0 right-0 p-6 opacity-[0.05] group-hover:scale-110 transition-transform duration-1000">
              <Sparkles size={140} />
            </div>
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600 dark:text-amber-400">{t('premium_neural_setup', preferences.language)}</span>
                </div>
                <h3 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white">
                  {tradeOfTheDay.pair} <span className={tradeOfTheDay.bias === 'BULLISH' ? 'text-emerald-500' : 'text-red-500'}>{tradeOfTheDay.bias}</span>
                </h3>
              </div>
              <Target size={32} className="text-amber-500" />
            </div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-8 leading-relaxed max-w-md">
              {tradeOfTheDay.rationale}
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className="glass p-4 rounded-2xl flex flex-col gap-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('entry', preferences.language)}</span>
                <span className="text-base font-black tabular-nums">{tradeOfTheDay.levels.entry}</span>
              </div>
              <div className="glass p-4 rounded-2xl flex flex-col gap-1 border-emerald-500/20">
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">{t('take_profit', preferences.language)}</span>
                <span className="text-base font-black text-emerald-500 tabular-nums">{tradeOfTheDay.levels.target}</span>
              </div>
              <div className="glass p-4 rounded-2xl flex flex-col gap-1 border-red-500/20">
                <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">{t('stop_loss', preferences.language)}</span>
                <span className="text-base font-black text-red-500 tabular-nums">{tradeOfTheDay.levels.stop}</span>
              </div>
            </div>
          </div>
        )}

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('market_bias', preferences.language)}</h3>
              <Activity size={14} className="text-sky-500 animate-pulse" />
            </div>
            <div className="flex items-center gap-6">
              <div className="relative w-20 h-20 shrink-0">
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
                <div className="absolute inset-0 flex items-center justify-center text-sm font-black">{Math.round(marketStrength)}%</div>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 mb-1">{t('sentiment', preferences.language)}: <span className={marketStrength > 50 ? 'text-emerald-500' : 'text-red-500'}>{marketStrength > 50 ? 'BULLISH' : 'BEARISH'}</span></p>
                <p className="text-[10px] text-slate-400 leading-tight">Neural synthesis of retail vs institutional order flow.</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('institutional_strategy', preferences.language)}</h3>
              <BrainCircuit size={16} className="text-sky-500" />
            </div>
            <p className="text-xs font-medium text-slate-400 mb-4 leading-relaxed">Synthesis of today's macro catalysts and volatility patterns.</p>
            <Button variant="secondary" size="sm" fullWidth onClick={fetchTradingPlan} className="rounded-xl py-3 border-2 font-black uppercase tracking-widest text-[9px]">
              {isLoadingPlan ? <Loader2 size={12} className="animate-spin" /> : t('synthesize', preferences.language)}
            </Button>
          </div>
        </div>

        {/* Risk Map */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
             <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t('volatility_risk_map', preferences.language)}</h3>
             <Flame size={14} className="text-orange-500" />
          </div>
          <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 no-scrollbar">
            {Object.entries(riskScores as Record<string, number>).sort((a,b) => b[1] - a[1]).map(([pair, score]) => (
              <div key={pair} className="flex-shrink-0 w-28 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] flex flex-col items-center gap-3 hover:border-orange-500/30 transition-all cursor-default">
                <span className="text-[11px] font-black text-slate-400">{pair}</span>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${score > 7 ? 'bg-red-500' : score > 4 ? 'bg-orange-500' : 'bg-emerald-500'}`} 
                    style={{ width: `${score * 10}%` }}
                  />
                </div>
                <span className={`text-[10px] font-black ${score > 7 ? 'text-red-500' : score > 4 ? 'text-orange-500' : 'text-emerald-500'}`}>
                  {score}/10
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex justify-between items-center glass p-3 rounded-[2rem] sticky top-20 z-40 shadow-xl border-slate-200/50 dark:border-slate-800/50">
          <div className="flex gap-2">
            <Button 
              variant="primary" 
              size="sm" 
              onClick={() => setIsLiveModalOpen(true)}
              className="h-11 px-6 rounded-2xl bg-sky-500"
            >
              <Mic size={14} className="mr-2" />
              <span className="text-[10px] font-black uppercase tracking-widest">{t('desk_ai', preferences.language)}</span>
            </Button>
            <Button 
              variant={isPlayingBriefing ? "danger" : "secondary"} 
              size="sm" 
              onClick={handleAudioBriefing} 
              disabled={isBriefingLoading}
              className="h-11 px-6 rounded-2xl"
            >
              {isBriefingLoading ? <Loader2 size={14} className="animate-spin" /> : isPlayingBriefing ? <Square size={14} /> : <Volume2 size={14} />}
              <span className="ml-2 text-[10px] font-black uppercase tracking-widest">{t('brief', preferences.language)}</span>
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSync} disabled={isSyncing} className="h-11 px-4 text-slate-500">
            <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
          </Button>
        </div>

        {/* Event List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-black text-[10px] uppercase tracking-[0.3em] text-slate-400">{t('intelligence_stream', preferences.language)}</h2>
            <div className="text-slate-400 text-[9px] font-black uppercase tracking-widest">
              {preferences.timezone}
            </div>
          </div>

          <div className="space-y-3">
            {news.map(n => (
              <div 
                key={n.id} 
                onClick={() => openAssessment(n)}
                className={`p-5 rounded-[2rem] border transition-all flex justify-between items-center group cursor-pointer ${
                  isPast(new Date(n.time)) 
                  ? 'bg-slate-50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800 opacity-30 grayscale' 
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-500/50 shadow-sm'
                }`}
              >
                <div className="flex gap-4 items-center">
                  <div className={`w-14 h-14 rounded-2xl border flex flex-col items-center justify-center font-mono font-bold shrink-0 ${getImpactColor(n.impact)}`}>
                    <span className="text-[9px] opacity-60 tracking-tighter">{n.currency}</span>
                    <span className="text-base tracking-tighter">{formatLocalTime(new Date(n.time), preferences.timezone)}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {/* Use AI provided flag, or fallback to currency map */}
                      <span className="text-2xl leading-none filter drop-shadow-md">
                        {n.flag || CURRENCY_FLAGS[n.currency]}
                      </span>
                      <h4 className="font-black text-sm text-slate-900 dark:text-slate-100 group-hover:text-sky-500 line-clamp-1">{n.title}</h4>
                    </div>
                    <div className="flex gap-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      <span>{t('fcst', preferences.language)}: {n.forecast || '-'}</span>
                      <span>{t('prev', preferences.language)}: {n.previous || '-'}</span>
                    </div>
                  </div>
                </div>
                {!isPast(new Date(n.time)) && <ChevronRight size={18} className="text-slate-300 group-hover:text-sky-500 transition-colors" />}
              </div>
            ))}
          </div>
        </div>

        {/* Sources Citation */}
        {groundingSources.length > 0 && (
          <div className="pt-10 border-t border-slate-200 dark:border-slate-800">
             <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-6 px-1">{t('institutional_sources', preferences.language)}</h3>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {groundingSources.map((chunk, i) => chunk.web && (
                <a 
                  key={i} href={chunk.web.uri} target="_blank" rel="noreferrer"
                  className="flex items-center justify-between p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-emerald-500/30 transition-all group"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <ExternalLink size={14} className="text-emerald-500 shrink-0" />
                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 truncate">{chunk.web.title}</span>
                  </div>
                  <Badge variant="success" className="opacity-50 shrink-0">{t('verified', preferences.language)}</Badge>
                </a>
              ))}
             </div>
          </div>
        )}
      </div>

      {/* Modals Implementation (Analysis & Strategy) */}
      {(selectedEvent || isPlanOpen) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[3rem] overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-3">
                {isPlanOpen ? <Target size={20} className="text-sky-500" /> : <BrainCircuit size={20} className="text-sky-500" />}
                <h3 className="font-black text-[10px] uppercase tracking-[0.3em]">{isPlanOpen ? t('institutional_strategy', preferences.language) : t('volatility_risk_map', preferences.language)}</h3>
              </div>
              <button onClick={() => { setSelectedEvent(null); setIsPlanOpen(false); }} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><X size={20} /></button>
            </div>
            
            <div className="p-10 max-h-[60vh] overflow-y-auto no-scrollbar">
              {(loadingAssessment || isLoadingPlan) ? (
                <div className="py-20 flex flex-col items-center gap-6">
                  <Loader2 size={32} className="text-sky-500 animate-spin" />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('running_models', preferences.language)}</p>
                </div>
              ) : (
                <div className="prose prose-slate dark:prose-invert max-w-none text-sm font-medium leading-relaxed whitespace-pre-wrap">
                  {isPlanOpen ? tradingPlan : assessment}
                </div>
              )}
            </div>

            <div className="p-8">
              <Button variant="primary" size="lg" fullWidth onClick={() => { setSelectedEvent(null); setIsPlanOpen(false); }} className="rounded-2xl py-5 shadow-xl shadow-sky-500/20 text-[10px] font-black uppercase tracking-[0.2em]">
                {t('acknowledge', preferences.language)}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLiveModalOpen && <LiveAnalyst onClose={() => setIsLiveModalOpen(false)} />}
    </AppShell>
  );
};

export default Dashboard;
