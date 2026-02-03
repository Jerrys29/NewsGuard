
import React, { useState, useEffect, useRef, useMemo } from 'react';
import AppShell from '../components/layout/AppShell';
import LiveAnalyst from '../components/LiveAnalyst';
import { useAppStore } from '../store';
import { Impact, NewsEvent, SentimentData } from '../types';
import { formatLocalTime, getImpactColor, getNextNews, formatDuration, decodeBase64, decodeAudioData } from '../utils';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { CURRENCY_FLAGS, NO_TRADE_RULES } from '../constants';
import { Clock, TrendingUp, AlertTriangle, RefreshCw, BrainCircuit, ExternalLink, X, Volume2, Square, Loader2, BarChart3, TrendingDown, ChevronRight, Mic, Target, Flame, Info, Activity, Sparkles, Navigation } from 'lucide-react';
import { differenceInSeconds, isPast, getHours } from 'date-fns';
import { fetchLiveNewsWithSearch, getRiskAssessment, generateAudioBriefing, getMarketSentiment, getDailyTradingPlan, getPairRiskScores, getTradeOfTheDay } from '../services/ai';

const Dashboard: React.FC = () => {
  const { news, sentiments, setSentiments, preferences, setNews, isSyncing, setIsSyncing, groundingSources, setRiskScores, riskScores, tradeOfTheDay, setTradeOfTheDay } = useAppStore();
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
      setAssessment("Analysis temporarily unavailable. Institutional feed error.");
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
      setTradingPlan("Strategic overlay synthesis failed. Consult manual desk reports.");
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
        {/* Top Status Bar */}
        <div className="flex items-center gap-2 px-1">
          <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${isNoTradeDay ? 'bg-red-500' : 'bg-emerald-500'}`}
              style={{ width: isSyncing ? '40%' : '100%' }}
            />
          </div>
          <span className={`text-[10px] font-black uppercase tracking-widest ${isNoTradeDay ? 'text-red-500' : 'text-emerald-500'} whitespace-nowrap`}>
            {isNoTradeDay ? 'High Risk Desk' : 'Optimized Liquidity'}
          </span>
        </div>

        {/* Neural Pick Section (Trade Setup) */}
        {tradeOfTheDay && (
          <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-500/30 rounded-[2.5rem] p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-[0.05] group-hover:scale-125 transition-transform duration-1000">
              <Sparkles size={120} />
            </div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <Badge variant="warning" className="mb-2 bg-amber-500 text-white border-none px-3 py-1">Neural Pick</Badge>
                <h3 className="text-2xl font-black tracking-tighter">{tradeOfTheDay.pair} <span className={tradeOfTheDay.bias === 'BULLISH' ? 'text-emerald-500' : 'text-red-500'}>{tradeOfTheDay.bias}</span></h3>
              </div>
              <Target size={24} className="text-amber-500" />
            </div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              {tradeOfTheDay.rationale}
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Entry</span>
                <span className="text-sm font-black">{tradeOfTheDay.levels.entry}</span>
              </div>
              <div className="bg-white dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Target</span>
                <span className="text-sm font-black text-emerald-500">{tradeOfTheDay.levels.target}</span>
              </div>
              <div className="bg-white dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Stop</span>
                <span className="text-sm font-black text-red-500">{tradeOfTheDay.levels.stop}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Dashboard;