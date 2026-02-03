
import React, { useEffect, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import NoTradeConfigPage from './pages/NoTradeConfigPage';
import { generateMockNews, getNextNews } from './utils';
import { fetchLiveNewsWithSearch, getMarketSentiment, getPairRiskScores } from './services/ai';
import { differenceInSeconds } from 'date-fns';

const App: React.FC = () => {
  const { 
    isOnboarded, 
    preferences, 
    setNews, 
    setSentiments, 
    setRiskScores, 
    lastSync, 
    setIsSyncing,
    news
  } = useAppStore();

  const syncAll = useCallback(async () => {
    setIsSyncing(true);
    try {
      const newsResult = await fetchLiveNewsWithSearch();
      setNews(newsResult.news, newsResult.sources);
      
      const [sentimentResult, scoresResult] = await Promise.all([
        getMarketSentiment(newsResult.news, preferences.selectedPairs),
        getPairRiskScores(newsResult.news, preferences.selectedPairs)
      ]);
      
      setSentiments(sentimentResult);
      setRiskScores(scoresResult);
    } catch (e) {
      console.error("Auto-sync failed", e);
    } finally {
      setIsSyncing(false);
    }
  }, [preferences.selectedPairs, setIsSyncing, setNews, setSentiments, setRiskScores]);

  useEffect(() => {
    // Theme application
    if (preferences.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (preferences.theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
    }
  }, [preferences.theme]);

  useEffect(() => {
    if (isOnboarded) {
      if (!lastSync) {
        setNews(generateMockNews());
      }

      const FOUR_HOURS = 4 * 60 * 60 * 1000;
      if (!lastSync || (Date.now() - lastSync > FOUR_HOURS)) {
        syncAll();
      }
    }
  }, [isOnboarded, lastSync, syncAll, setNews]);

  // Global Notification Engine
  useEffect(() => {
    if (!preferences.notificationsEnabled) return;

    const checkNotifications = () => {
      const next = getNextNews(news);
      if (!next) return;

      const diff = differenceInSeconds(new Date(next.time), new Date());
      const triggerSeconds = preferences.notifyMinutesBefore * 60;

      // Trigger if within the notification window (e.g., 15 mins before)
      // We check if the difference is between triggerSeconds and triggerSeconds - 60s
      if (diff > 0 && diff <= triggerSeconds && diff > triggerSeconds - 60) {
        const alertedKey = `alerted-${next.id}`;
        if (!localStorage.getItem(alertedKey)) {
          new Notification(`News Guard: High Impact Alert`, {
            body: `${next.title} (${next.currency}) in ${preferences.notifyMinutesBefore} minutes. Volatility expected.`,
            icon: '/favicon.ico'
          });
          localStorage.setItem(alertedKey, 'true');
        }
      }
    };

    const interval = setInterval(checkNotifications, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [news, preferences.notificationsEnabled, preferences.notifyMinutesBefore]);

  return (
    <Router>
      <Routes>
        <Route 
          path="/onboarding" 
          element={!isOnboarded ? <Onboarding /> : <Navigate to="/" replace />} 
        />
        <Route 
          path="/" 
          element={isOnboarded ? <Dashboard /> : <Navigate to="/onboarding" replace />} 
        />
        <Route 
          path="/notrade" 
          element={isOnboarded ? <NoTradeConfigPage /> : <Navigate to="/onboarding" replace />} 
        />
        <Route 
          path="/settings" 
          element={isOnboarded ? <Settings /> : <Navigate to="/onboarding" replace />} 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
