
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppPreferences, Impact, NewsEvent, SentimentData } from './types';
import { NO_TRADE_RULES } from './constants';

export type View = 'onboarding' | 'dashboard' | 'notrade' | 'settings';

export interface TradeSetup {
  pair: string;
  bias: 'BULLISH' | 'BEARISH';
  rationale: string;
  levels: {
    entry: string;
    target: string;
    stop: string;
  };
}

interface AppState {
  isOnboarded: boolean;
  preferences: AppPreferences;
  news: NewsEvent[];
  sentiments: SentimentData[];
  riskScores: Record<string, number>;
  tradeOfTheDay: TradeSetup | null;
  groundingSources: any[];
  lastSync: number | null;
  isSyncing: boolean;
  currentView: View;

  // Actions
  completeOnboarding: () => void;
  updatePreferences: (prefs: Partial<AppPreferences>) => void;
  setNews: (news: NewsEvent[], sources?: any[]) => void;
  setSentiments: (sentiments: SentimentData[]) => void;
  setRiskScores: (scores: Record<string, number>) => void;
  setTradeOfTheDay: (trade: TradeSetup | null) => void;
  setIsSyncing: (isSyncing: boolean) => void;
  togglePair: (pairId: string) => void;
  toggleImpact: (impact: Impact) => void;
  resetApp: () => void;
  setCurrentView: (view: View) => void;
}

const DEFAULT_PREFS: AppPreferences = {
  selectedPairs: ['EURUSD', 'XAUUSD', 'GBPUSD'],
  impactFilters: [Impact.HIGH, Impact.MEDIUM],
  alwaysIncludeUSD: true,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  notificationsEnabled: false,
  notifyMinutesBefore: 15,
  theme: 'dark',
  noTradeRules: NO_TRADE_RULES.map(r => r.id),
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isOnboarded: false,
      preferences: DEFAULT_PREFS,
      news: [],
      sentiments: [],
      riskScores: {},
      tradeOfTheDay: null,
      groundingSources: [],
      lastSync: null,
      isSyncing: false,
      currentView: 'onboarding',

      completeOnboarding: () => set({ isOnboarded: true }),

      updatePreferences: (newPrefs) => set((state) => ({
        preferences: { ...state.preferences, ...newPrefs }
      })),

      setNews: (news, sources = []) => set({
        news,
        groundingSources: sources,
        lastSync: Date.now(),
        isSyncing: false
      }),

      setSentiments: (sentiments) => set({ sentiments }),
      setRiskScores: (riskScores) => set({ riskScores }),
      setTradeOfTheDay: (tradeOfTheDay) => set({ tradeOfTheDay }),

      setIsSyncing: (isSyncing) => set({ isSyncing }),

      togglePair: (pairId) => set((state) => {
        const selected = state.preferences.selectedPairs.includes(pairId)
          ? state.preferences.selectedPairs.filter(p => p !== pairId)
          : [...state.preferences.selectedPairs, pairId];
        return { preferences: { ...state.preferences, selectedPairs: selected } };
      }),

      toggleImpact: (impact) => set((state) => {
        const filters = state.preferences.impactFilters.includes(impact)
          ? state.preferences.impactFilters.filter(f => f !== impact)
          : [...state.preferences.impactFilters, impact];
        return { preferences: { ...state.preferences, impactFilters: filters } };
      }),

      resetApp: () => set({
        isOnboarded: false,
        preferences: DEFAULT_PREFS,
        news: [],
        sentiments: [],
        riskScores: {},
        tradeOfTheDay: null,
        groundingSources: [],
        lastSync: null,
        currentView: 'onboarding'
      }),

      setCurrentView: (view) => set({ currentView: view }),
    }),
    {
      name: 'news-guard-storage',
    }
  )
);
