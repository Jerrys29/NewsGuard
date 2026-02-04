
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { NewsEvent, Impact, SentimentData, TradeSetup } from "../types";
import { useAppStore } from '../store';

export const getAIAnalyst = () => new GoogleGenAI({ apiKey: process.env.API_KEY! });

const getLangInstruction = () => {
  const { language } = useAppStore.getState().preferences;
  const map: Record<string, string> = {
    'en': 'English',
    'fr': 'French',
    'es': 'Spanish',
    'de': 'German',
    'jp': 'Japanese'
  };
  return `Output Language: ${map[language] || 'English'}.`;
};

const getRiskInstruction = () => {
  const { riskTolerance } = useAppStore.getState().preferences;
  return `Trader Risk Profile: ${riskTolerance.toUpperCase()}.`;
};

export async function fetchLiveNewsWithSearch(targetDate?: string): Promise<{ news: NewsEvent[], sources: any[] }> {
  const ai = getAIAnalyst();
  const dateStr = targetDate || new Date().toISOString().split('T')[0];
  
  const prompt = `Search for economic news events specifically for date: ${dateStr}.
  Focus on USD, EUR, GBP, and JPY. Return the data as a JSON array of objects with the following structure:
  {
    "title": "Exact name of the event",
    "currency": "USD/EUR/etc",
    "flag": "Specific Country Emoji (e.g. 🇺🇸, 🇩🇪, 🇫🇷, 🇮🇹, 🇬🇧, 🇯🇵)",
    "impact": "HIGH/MEDIUM/LOW",
    "time": "ISO 8601 timestamp (ensure the date matches ${dateStr})",
    "forecast": "Consensus/Forecast value (e.g. 2.5%) or '-' if unavailable",
    "previous": "Previous release value (e.g. 2.4%) or '-' if unavailable",
    "actual": "Actual released value (e.g. 2.6%) or '-' if not yet released/future event",
    "isNoTrade": boolean (true if it's NFP, FOMC, CPI, or Rate Decision)
  }. IMPORTANT: Only return the JSON array, no extra text.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
    },
  });

  try {
    const text = response.text || "[]";
    const news = JSON.parse(text);
    return {
      news: news.map((n: any, i: number) => ({
        ...n,
        id: `ai-news-${i}-${Date.now()}`,
        time: new Date(n.time)
      })),
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (e) {
    console.error("Failed to parse AI news", e);
    return { news: [], sources: [] };
  }
}

export async function getMarketSentiment(news: NewsEvent[], pairs: string[]): Promise<SentimentData[]> {
  const ai = getAIAnalyst();
  const context = news.map(n => `${n.title} (${n.currency})`).join(", ");
  const prompt = `Analyze market sentiment for ${pairs.join(", ")} given these upcoming events: ${context}. 
  ${getLangInstruction()}
  Return a JSON array:
  [{
    "pair": "Pair Name",
    "bias": "BULLISH/BEARISH/NEUTRAL",
    "score": number (0-100),
    "reason": "One sentence rationale in ${useAppStore.getState().preferences.language}"
  }]`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    return [];
  }
}

export async function getPairRiskScores(news: NewsEvent[], pairs: string[]): Promise<Record<string, number>> {
  const ai = getAIAnalyst();
  const context = news.map(n => `${n.currency}: ${n.impact}`).join(", ");
  const prompt = `Rate volatility risk (0-10) for ${pairs.join(", ")} based on: ${context}. 
  Return JSON object: {"PAIR": score}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    return {};
  }
}

export async function getTradeOfTheDay(news: NewsEvent[], sentiments: SentimentData[]): Promise<TradeSetup | null> {
  const ai = getAIAnalyst();
  const newsContext = news.filter(n => n.impact === Impact.HIGH).map(n => n.title).join(", ");
  const sentContext = sentiments.map(s => `${s.pair}: ${s.bias}`).join(", ");
  
  const prompt = `Context: ${newsContext}. Sentiments: ${sentContext}.
  Identify the #1 high-probability trade setup. 
  ${getRiskInstruction()}
  ${getLangInstruction()}
  Return JSON:
  {
    "pair": "NAME",
    "bias": "BULLISH/BEARISH",
    "rationale": "Reason in target language",
    "levels": { "entry": "Price", "target": "Price", "stop": "Price" }
  }`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });

  try {
    return JSON.parse(response.text || "null");
  } catch (e) {
    return null;
  }
}

export async function getRiskAssessment(event: NewsEvent): Promise<string> {
  const ai = getAIAnalyst();
  const prompt = `Analyze risk for: ${event.title} (${event.currency}). 
  ${getLangInstruction()}
  Provide: 1. Expected Move, 2. Liquidity Risk, 3. Recommended Safety Window. 
  Professional markdown format.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return response.text || "Assessment unavailable.";
}

export async function generateAudioBriefing(news: NewsEvent[]): Promise<string | undefined> {
  const ai = getAIAnalyst();
  const highImpact = news.filter(n => n.impact === Impact.HIGH);
  if (highImpact.length === 0) return undefined;
  
  const { language } = useAppStore.getState().preferences;
  // Map common languages to available voices or just use Kore as generic
  const prompt = `Summarize risks: ${highImpact.map(n => n.title).join(", ")}. Be brief and professional (30s). Language: ${language}.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
    },
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
}

export async function getDailyTradingPlan(news: NewsEvent[], sentiments: SentimentData[]): Promise<string> {
  const ai = getAIAnalyst();
  const prompt = `Generate a daily strategy brief based on: ${news.length} events and current sentiments. 
  ${getRiskInstruction()}
  ${getLangInstruction()}
  Focus on execution and risk guard. Professional Markdown.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return response.text || "No plan generated.";
}
