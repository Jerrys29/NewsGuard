
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { NewsEvent, Impact, SentimentData } from "../types";

export const getAIAnalyst = () => new GoogleGenAI({ apiKey: process.env.API_KEY! });

export async function fetchLiveNewsWithSearch(): Promise<{ news: NewsEvent[], sources: any[] }> {
  const ai = getAIAnalyst();
  const today = new Date().toISOString().split('T')[0];

  const prompt = `Find the high-impact economic news events for today (${today}) and the next 24 hours. 
  Focus on USD, EUR, GBP, and JPY. Return the data as a JSON array of objects with the following structure:
  {
    "title": "Exact name of the event",
    "currency": "USD/EUR/etc",
    "impact": "HIGH/MEDIUM/LOW",
    "time": "ISO 8601 timestamp",
    "forecast": "Expected value if available",
    "previous": "Previous value if available",
    "isNoTrade": boolean (true if it's NFP, FOMC, CPI, or Rate Decision)
  }`;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-exp",
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
        id: `ai-news-${i}`,
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
  const prompt = `Based on these upcoming economic events: ${context}, provide a market sentiment analysis for these pairs: ${pairs.join(", ")}. 
  Return a JSON array of objects:
  {
    "pair": "Pair Name",
    "bias": "BULLISH/BEARISH/NEUTRAL",
    "score": number (0-100 strength),
    "reason": "One sentence explanation"
  }`;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-exp",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    return [];
  }
}

export async function getRiskAssessment(event: NewsEvent): Promise<string> {
  const ai = getAIAnalyst();
  const prompt = `As a professional hedge fund risk manager, explain the expected market reaction and volatility pattern for the upcoming economic event: "${event.title}" (${event.currency}). 
  Include: 
  1. Typical slippage risk.
  2. Historical volatility (pips/points).
  3. Recommended 'No-Trade' window (e.g., 5 mins before, 15 mins after).
  Keep it concise and formatted in professional markdown.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-exp",
    contents: prompt,
  });

  return response.text || "Assessment unavailable.";
}

export async function generateAudioBriefing(news: NewsEvent[]): Promise<string | undefined> {
  const ai = getAIAnalyst();
  const highImpact = news.filter(n => n.impact === Impact.HIGH);

  if (highImpact.length === 0) return undefined;

  const eventsSummary = highImpact.map(n => `${n.title} for the ${n.currency} at ${n.time.toLocaleTimeString()}`).join(". ");
  const prompt = `Summarize today's major trading risks. Mention these key events: ${eventsSummary}. 
  Start with "Good morning trader, here is your volatility briefing." and keep it under 40 seconds. 
  Be professional and alert.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-exp",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
}

export async function getDailyTradingPlan(news: NewsEvent[], sentiments: SentimentData[]): Promise<string> {
  const ai = getAIAnalyst();
  const newsContext = news.filter(n => n.impact === Impact.HIGH).map(n => n.title).join(", ");
  const sentimentContext = sentiments.map(s => `${s.pair}: ${s.bias} (${s.score}%)`).join(", ");

  const prompt = `Generate a high-level daily trading strategy based on these news events: ${newsContext} and these sentiments: ${sentimentContext}. 
  Format as a professional brief with sections: 
  - OVERVIEW 
  - KEY FOCUS 
  - RISK GUARD 
  Keep it very concise and actionable for a day trader. Use bold text for emphasis.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-exp",
    contents: prompt,
  });

  return response.text || "No plan generated.";
}
