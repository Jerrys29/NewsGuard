
export enum Impact {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD' | 'CHF' | 'NZD' | 'XAU' | 'XAG';

export interface TradingPair {
  id: string;
  name: string;
  category: 'Forex' | 'Metals' | 'Indices';
  currencies: Currency[];
}

export interface NewsEvent {
  id: string;
  title: string;
  currency: Currency;
  impact: Impact;
  time: Date;
  forecast?: string;
  previous?: string;
  actual?: string;
  isNoTrade?: boolean;
}

export interface SentimentData {
  pair: string;
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  score: number; // 0 to 100
  reason: string;
}

export interface NoTradeRule {
  id: string;
  keywords: string[];
  description: string;
  volatility: 1 | 2 | 3;
  enabled: boolean;
}

export interface AppPreferences {
  selectedPairs: string[];
  impactFilters: Impact[];
  alwaysIncludeUSD: boolean;
  timezone: string;
  notificationsEnabled: boolean;
  notifyMinutesBefore: number;
  theme: 'light' | 'dark' | 'system';
  noTradeRules: string[];
}
