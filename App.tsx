
import React, { useEffect, useCallback, useState } from 'react';
import { useAppStore } from './store';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import NoTradeConfigPage from './pages/NoTradeConfigPage';
import { generateMockNews, getNextNews } from './utils';
import { fetchLiveNewsWithSearch, getMarketSentiment, getPairRiskScores, getTradeOfTheDay } from './services/ai';
import { differenceInSeconds } from 'date-fns';

type View = 'onboarding' | 'dashboard' | 'notrade' | 'settings';

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

  const [currentView, setCurrentView] = useState<View>(isOnboarded ? 'dashboard' : 'onboarding');

  // Handle Initial view when onboarding status changes
  useEffect(() => {
    if (!isOnboarded) {
      setCurrentView('onboarding');
    } else if (currentView === 'onboarding') {
      setCurrentView('dashboard');
    }
  }, [isOnboarded, currentView]);

  const syncAll = useCallback(async (force = false) => {
    const STALE_THRESHOLD = 4 * 60 * 60 * 1000;
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
        getTradeOfTheDay(newsResult.news, []) // Simplified context for trade of the day
      ]);

      setSentiments(sentimentResult);
      setRiskScores(scoresResult);
      setTradeOfTheDay(tradeResult);
    } catch (e) {
      console.error("Global sync failed", e);
      if (!lastSync) {
        setNews(generateMockNews());
      }
    } finally {
      setIsSyncing(false);
    }
  }, [preferences.selectedPairs, setIsSyncing, setNews, setSentiments, setRiskScores, setTradeOfTheDay, lastSync]);

  // Handle Visibility and Lifecycle
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncAll();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [syncAll]);

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

  // Initial Sync
  useEffect(() => {
    if (isOnboarded) {
      syncAll();
    }
  }, [isOnboarded, syncAll]);

  // Notification Engine
  useEffect(() => {
    if (!preferences.notificationsEnabled) return;

    if (Notification.permission === 'denied') {
      updatePreferences({ notificationsEnabled: false });
      return;
    }

    const checkAndNotify = () => {
      const next = getNextNews(news);
      if (!next) return;

      const diff = differenceInSeconds(new Date(next.time), new Date());
      const notifyWindowSeconds = preferences.notifyMinutesBefore * 60;

      if (diff > 0 && diff <= notifyWindowSeconds && diff > (notifyWindowSeconds - 30)) {
        const alertedKey = `notified-${next.id}`;
        if (!localStorage.getItem(alertedKey)) {
          new Notification(`⚠️ News Alert: ${next.currency}`, {
            body: `${next.title} in ${preferences.notifyMinutesBefore}m. Check risk analysis.`,
            icon: '/favicon.ico',
            tag: next.id,
            requireInteraction: true
          });
          localStorage.setItem(alertedKey, 'true');
        }
      }
    };

    const interval = setInterval(checkAndNotify, 30000);
    return () => clearInterval(interval);
  }, [news, preferences.notificationsEnabled, preferences.notifyMinutesBefore, updatePreferences]);

  const renderView = () => {
    switch (currentView) {
      case 'onboarding':
        return <Onboarding />;
      case 'dashboard':
        return <Dashboard />;
      case 'notrade':
        return <NoTradeConfigPage />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 overflow-x-hidden">
      {renderView()}
    </div>
  );
};

export default App;
