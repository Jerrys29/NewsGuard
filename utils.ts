
import { format, isAfter, differenceInSeconds } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { NewsEvent, Impact } from './types';

export const formatLocalTime = (date: Date, timezone: string) => {
  return formatInTimeZone(date, timezone, 'HH:mm');
};

export const getImpactColor = (impact: Impact) => {
  switch (impact) {
    case Impact.HIGH: return 'text-red-500 bg-red-500/10 border-red-500/20';
    case Impact.MEDIUM: return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
    case Impact.LOW: return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
    default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
  }
};

export const getNextNews = (news: NewsEvent[]) => {
  const now = new Date();
  return news
    .filter(n => isAfter(new Date(n.time), now))
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())[0];
};

export const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')} : ${m.toString().padStart(2, '0')} : ${s.toString().padStart(2, '0')}`;
};

// Audio Utilities for Gemini TTS (Raw PCM)
export function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const generateMockNews = (): NewsEvent[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const times = [
    { h: 9, m: 0, title: 'German Manufacturing PMI', currency: 'EUR', impact: Impact.MEDIUM },
    { h: 10, m: 30, title: 'GBP Services PMI', currency: 'GBP', impact: Impact.MEDIUM },
    { h: 14, m: 30, title: 'US Core CPI m/m', currency: 'USD', impact: Impact.HIGH, isNoTrade: true },
    { h: 14, m: 30, title: 'US CPI y/y', currency: 'USD', impact: Impact.HIGH, isNoTrade: true },
    { h: 16, m: 0, title: 'FOMC Member Speaks', currency: 'USD', impact: Impact.LOW },
    { h: 20, m: 0, title: 'Oil Inventories', currency: 'USD', impact: Impact.MEDIUM },
  ];

  return times.map((t, i) => {
    const time = new Date(today);
    time.setHours(t.h, t.m);
    return {
      id: `news-${i}`,
      title: t.title,
      currency: t.currency as any,
      impact: t.impact,
      time,
      forecast: (Math.random() * 5).toFixed(1) + '%',
      previous: (Math.random() * 5).toFixed(1) + '%',
      isNoTrade: t.isNoTrade
    };
  });
};
