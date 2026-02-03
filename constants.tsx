
import React from 'react';
import { TradingPair, NoTradeRule, Impact } from './types';

export const TRADING_PAIRS: TradingPair[] = [
  { id: 'EURUSD', name: 'EURUSD', category: 'Forex', currencies: ['EUR', 'USD'] },
  { id: 'GBPUSD', name: 'GBPUSD', category: 'Forex', currencies: ['GBP', 'USD'] },
  { id: 'USDJPY', name: 'USDJPY', category: 'Forex', currencies: ['USD', 'JPY'] },
  { id: 'USDCHF', name: 'USDCHF', category: 'Forex', currencies: ['USD', 'CHF'] },
  { id: 'AUDUSD', name: 'AUDUSD', category: 'Forex', currencies: ['AUD', 'USD'] },
  { id: 'NZDUSD', name: 'NZDUSD', category: 'Forex', currencies: ['NZD', 'USD'] },
  { id: 'USDCAD', name: 'USDCAD', category: 'Forex', currencies: ['USD', 'CAD'] },
  { id: 'XAUUSD', name: 'XAUUSD', category: 'Metals', currencies: ['XAU', 'USD'] },
  { id: 'XAGUSD', name: 'XAGUSD', category: 'Metals', currencies: ['XAG', 'USD'] },
  { id: 'US30', name: 'US30', category: 'Indices', currencies: ['USD'] },
  { id: 'NAS100', name: 'NAS100', category: 'Indices', currencies: ['USD'] },
  { id: 'SPX500', name: 'SPX500', category: 'Indices', currencies: ['USD'] },
  { id: 'GER40', name: 'GER40', category: 'Indices', currencies: ['EUR'] },
];

export const NO_TRADE_RULES: NoTradeRule[] = [
  { id: 'NFP', keywords: ['Non-Farm Payroll', 'NFP'], description: 'Extremely high volatility in seconds.', volatility: 3, enabled: true },
  { id: 'FOMC_RATE', keywords: ['FOMC Rate Decision', 'Interest Rate Decision'], description: 'Directs the dollar trend.', volatility: 3, enabled: true },
  { id: 'CPI', keywords: ['CPI', 'Consumer Price Index', 'Inflation'], description: 'Huge impact on central bank rates.', volatility: 3, enabled: true },
  { id: 'FOMC_CONF', keywords: ['FOMC Press Conference'], description: 'Market reactions to Q&A.', volatility: 2, enabled: true },
  { id: 'FED_POWELL', keywords: ['Powell'], description: 'Hints on monetary policy.', volatility: 2, enabled: true },
  { id: 'ECB_RATE', keywords: ['ECB Interest Rate Decision'], description: 'Major EUR movement.', volatility: 3, enabled: true },
];

export const CURRENCY_FLAGS: Record<string, string> = {
  USD: '🇺🇸',
  EUR: '🇪🇺',
  GBP: '🇬🇧',
  JPY: '🇯🇵',
  AUD: '🇦🇺',
  CAD: '🇨🇦',
  CHF: '🇨🇭',
  NZD: '🇳🇿',
  XAU: '🪙',
  XAG: '🥈',
};
