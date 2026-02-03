
import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import NoTradeConfigPage from './pages/NoTradeConfigPage';
import { generateMockNews } from './utils';
import { fetchLiveNewsWithSearch, getMarketSentiment } from './services/ai';

const App: React.FC = () => {
  const { isOnboarded, preferences, setNews, setSentiments, lastSync, setIsSyncing } = useAppStore();

  useEffect(() => {
    // Sync theme
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
    const handleInitialSync = async () => {
      // If no data yet, load mock or attempt sync if onboarded
      if (!lastSync) {
        setNews(generateMockNews());
      }

      // Auto-sync if data is older than 4 hours
      const FOUR_HOURS = 4 * 60 * 60 * 1000;
      if (isOnboarded && (!lastSync || (Date.now() - lastSync > FOUR_HOURS))) {
        setIsSyncing(true);
        try {
          const result = await fetchLiveNewsWithSearch();
          setNews(result.news, result.sources);
          const sentimentResult = await getMarketSentiment(result.news, preferences.selectedPairs);
          setSentiments(sentimentResult);
        } catch (e) {
          console.error("Auto-sync failed", e);
          setIsSyncing(false);
        }
      }
    };

    handleInitialSync();
  }, [isOnboarded, lastSync, setNews, setSentiments, setIsSyncing, preferences.selectedPairs]);

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 overflow-x-hidden">
        <Routes>
          {!isOnboarded ? (
            <>
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="*" element={<Navigate to="/onboarding" />} />
            </>
          ) : (
            <>
              <Route path="/" element={<Dashboard />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/notrade" element={<NoTradeConfigPage />} />
              <Route path="*" element={<Navigate to="/" />} />
            </>
          )}
        </Routes>
      </div>
    </Router>
  );
};

export default App;
