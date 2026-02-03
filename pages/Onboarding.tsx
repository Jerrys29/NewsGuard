
import React, { useState } from 'react';
import { useAppStore } from '../store';
import { Button } from '../components/ui/Button';
import { TRADING_PAIRS } from '../constants';
import { ShieldAlert, CheckCircle2, Globe, Bell } from 'lucide-react';

const Onboarding: React.FC = () => {
  const [step, setStep] = useState(0);
  const { preferences, togglePair, updatePreferences, completeOnboarding } = useAppStore();

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const steps = [
    // Welcome
    <div key="step-0" className="space-y-8 text-center py-10">
      <div className="w-20 h-20 bg-sky-500 rounded-3xl flex items-center justify-center text-white mx-auto shadow-2xl shadow-sky-500/40">
        <ShieldAlert size={40} />
      </div>
      <div className="space-y-3">
        <h1 className="text-3xl font-extrabold tracking-tight">News Guard</h1>
        <p className="text-slate-500 dark:text-slate-400 px-6">
          The ultimate shield for your trading capital. Never miss a critical economic event again.
        </p>
      </div>
      <Button size="lg" onClick={nextStep} fullWidth>Get Started</Button>
    </div>,

    // Pair Selection
    <div key="step-1" className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Trading Pairs</h2>
        <p className="text-slate-500 dark:text-slate-400">Which instruments do you trade?</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {TRADING_PAIRS.map(pair => (
          <button
            key={pair.id}
            onClick={() => togglePair(pair.id)}
            className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
              preferences.selectedPairs.includes(pair.id)
                ? 'bg-sky-500/10 border-sky-500 text-sky-600'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
            }`}
          >
            <span className="font-bold">{pair.name}</span>
            {preferences.selectedPairs.includes(pair.id) && <CheckCircle2 size={18} />}
          </button>
        ))}
      </div>
      <div className="flex gap-4">
        <Button variant="ghost" onClick={prevStep} fullWidth>Back</Button>
        <Button onClick={nextStep} fullWidth>Continue</Button>
      </div>
    </div>,

    // Notifications
    <div key="step-2" className="space-y-8 text-center py-6">
      <div className="w-20 h-20 bg-sky-100 dark:bg-sky-500/20 rounded-full flex items-center justify-center text-sky-500 mx-auto">
        <Bell size={40} />
      </div>
      <div className="space-y-3">
        <h2 className="text-2xl font-bold">Stay Alerted</h2>
        <p className="text-slate-500 dark:text-slate-400">
          Get notified 15 minutes before high-impact events and at the start of the day.
        </p>
      </div>
      <div className="bg-slate-100 dark:bg-slate-900 rounded-2xl p-6 text-left border border-slate-200 dark:border-slate-800">
        <div className="flex gap-3 items-start opacity-70 mb-4 blur-[1px]">
          <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-700 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-300 dark:bg-slate-700 w-24 rounded" />
            <div className="h-3 bg-slate-200 dark:bg-slate-800 w-full rounded" />
          </div>
        </div>
        <div className="flex gap-3 items-start">
          <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white">
            <ShieldAlert size={16} />
          </div>
          <div className="flex-1 space-y-1">
            <p className="font-bold text-sm">US CPI in 15 min 🔴</p>
            <p className="text-xs text-slate-500">Core CPI m/m · 14:30 · Be ready!</p>
          </div>
        </div>
      </div>
      <div className="flex gap-4">
        <Button variant="ghost" onClick={prevStep} fullWidth>Back</Button>
        <Button onClick={() => { updatePreferences({ notificationsEnabled: true }); completeOnboarding(); }} fullWidth>Enable & Finish</Button>
      </div>
    </div>
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-md bg-white dark:bg-slate-950 p-6 rounded-3xl">
        <div className="flex justify-center gap-1 mb-8">
          {steps.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-sky-500' : 'w-1.5 bg-slate-200 dark:bg-slate-800'}`} />
          ))}
        </div>
        {steps[step]}
      </div>
    </div>
  );
};

export default Onboarding;
