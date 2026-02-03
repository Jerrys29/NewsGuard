
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
    news,
    updatePreferences
  } = useAppStore();

  const syncAll = useCallback(async () => {
    setIsSyncing(true);
    try {
      // 1. Fetch News via Search Grounding
      const newsResult = await fetchLiveNewsWithSearch();
      setNews(newsResult.news, newsResult.sources);
      
      // 2. Fetch Analysis & Risks based on news context
      const pairs = preferences.selectedPairs;
      const [sentimentResult, scoresResult] = await Promise.all([
        getMarketSentiment(newsResult.news, pairs),
        getPairRiskScores(newsResult.news, pairs)
      ]);
      
      setSentiments(sentimentResult);
      setRiskScores(scoresResult);
    } catch (e) {
      console.error("Critical: Global synchronization failed", e);
      // Fallback to mock data if it's the first time and it fails
      if (!lastSync) {
        setNews(generateMockNews());
      }
    } finally {
      setIsSyncing(false);
    }
  }, [preferences.selectedPairs, setIsSyncing, setNews, setSentiments, setRiskScores, lastSync]);

  // Handle Theme Application
  useEffect(() => {
    const root = window.document.documentElement;
    if (preferences.theme === 'dark') {
      root.classList.add('dark');
    } else if (preferences.theme === 'light') {
      root.classList.remove('dark');
    } else {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', systemDark);
    }
  }, [preferences.theme]);

  // Automated Sync Strategy
  useEffect(() => {
    if (isOnboarded) {
      const FOUR_HOURS = 4 * 60 * 60 * 1000;
      const isStale = !lastSync || (Date.now() - lastSync > FOUR_HOURS);
      
      if (isStale) {
        syncAll();
      }
    }
  }, [isOnboarded, lastSync, syncAll]);

  // Notification Health & Execution
  useEffect(() => {
    if (!preferences.notificationsEnabled) return;

    // Check permission status
    if (Notification.permission === 'denied') {
      console.warn("Notifications are enabled in app but denied by browser.");
      updatePreferences({ notificationsEnabled: false });
      return;
    }

    const checkAndNotify = () => {
      const next = getNextNews(news);
      if (!next) return;

      const releaseTime = new Date(next.time);
      const diff = differenceInSeconds(releaseTime, new Date());
      const notifyWindowSeconds = preferences.notifyMinutesBefore * 60;

      // Logic: Notify if the event is happening exactly within the next 30s window of the set threshold
      if (diff > 0 && diff <= notifyWindowSeconds && diff > (notifyWindowSeconds - 30)) {
        const alertedKey = `notified-${next.id}-${preferences.notifyMinutesBefore}`;
        if (!localStorage.getItem(alertedKey)) {
          new Notification(`⚠️ Trading Alert: ${next.currency}`, {
            body: `${next.title} in ${preferences.notifyMinutesBefore}m. High volatility expected.`,
            icon: '/favicon.ico',
            tag: next.id, // Replace old notifications for same event
            requireInteraction: true
          });
          localStorage.setItem(alertedKey, 'true');
        }
      }
    };

    const interval = setInterval(checkAndNotify, 20000); // Check every 20s
    return () => clearInterval(interval);
  }, [news, preferences.notificationsEnabled, preferences.notifyMinutesBefore, updatePreferences]);

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
