
import React, { useEffect, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import NoTradeConfigPage from './pages/NoTradeConfigPage';
import { generateMockNews, getNextNews } from './utils';
import { fetchLiveNewsWithSearch, getMarketSentiment, getPairRiskScores, getTradeOfTheDay } from './services/ai';
import { differenceInSeconds } from 'date-fns';

const App: React.FC = () => {
  const { 
    isOnboarded, 
    preferences, 
    setNews, 
    setSentiments, 
    setRiskScores, 
    setTradeOfTheDay,
    lastSync, 
    setIsSyncing,
    news,
    updatePreferences
  } = useAppStore();

  const syncAll = useCallback(async (force = false) => {
    // Refresh if data is older than 30 minutes for a more "live" feeling
    const STALE_THRESHOLD = 30 * 60 * 1000;
    const now = Date.now();
    
    if (!force && lastSync && (now - lastSync < STALE_THRESHOLD)) {
      return;
    }

    setIsSyncing(true);
    try {
      const newsResult = await fetchLiveNewsWithSearch();
      setNews(newsResult.news, newsResult.sources);
      
      const pairs = preferences.selectedPairs;
      const [sentimentResult, scoresResult, tradeResult] = await Promise.all([
        getMarketSentiment(newsResult.news, pairs),
        getPairRiskScores(newsResult.news, pairs),
        getTradeOfTheDay(newsResult.news, [])
      ]);
      
      setSentiments(sentimentResult);
      setRiskScores(scoresResult);
      setTradeOfTheDay(tradeResult);
    } catch (e) {
      console.error("Critical: Sync Engine Failed", e);
      if (!lastSync) {
        setNews(generateMockNews());
      }
    } finally {
      setIsSyncing(false);
    }
  }, [preferences.selectedPairs, setIsSyncing, setNews, setSentiments, setRiskScores, setTradeOfTheDay, lastSync]);

  // Sync on mount and visibility
  useEffect(() => {
    if (!isOnboarded) return;
    
    syncAll();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') syncAll();
    };
    
    window.addEventListener('visibilitychange', handleVisibility);
    return () => window.removeEventListener('visibilitychange', handleVisibility);
  }, [isOnboarded, syncAll]);

  // Notification Engine
  useEffect(() => {
    if (!preferences.notificationsEnabled || !news.length) return;

    const interval = setInterval(() => {
      const next = getNextNews(news);
      if (!next) return;

      const diff = differenceInSeconds(new Date(next.time), new Date());
      const targetSeconds = preferences.notifyMinutesBefore * 60;

      if (diff > 0 && diff <= targetSeconds && diff > (targetSeconds - 30)) {
        const key = `notified-${next.id}`;
        if (!localStorage.getItem(key)) {
          new Notification(`⚠️ Trading Alert: ${next.currency}`, {
            body: `${next.title} in ${preferences.notifyMinutesBefore}m. Extreme volatility expected.`,
            tag: next.id,
            requireInteraction: true
          });
          localStorage.setItem(key, 'true');
        }
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [news, preferences.notificationsEnabled, preferences.notifyMinutesBefore]);

  // Theme Management
  useEffect(() => {
    const root = window.document.documentElement;
    if (preferences.theme === 'dark') root.classList.add('dark');
    else if (preferences.theme === 'light') root.classList.remove('dark');
    else root.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, [preferences.theme]);

  return (
    <Router>
      <Routes>
        <Route path="/onboarding" element={!isOnboarded ? <Onboarding /> : <Navigate to="/" />} />
        <Route path="/" element={isOnboarded ? <Dashboard /> : <Navigate to="/onboarding" />} />
        <Route path="/notrade" element={isOnboarded ? <NoTradeConfigPage /> : <Navigate to="/onboarding" />} />
        <Route path="/settings" element={isOnboarded ? <Settings /> : <Navigate to="/onboarding" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
};

export default App;
