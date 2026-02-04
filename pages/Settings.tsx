
import React from 'react';
import AppShell from '../components/layout/AppShell';
import { useAppStore } from '../store';
import { Button } from '../components/ui/Button';
import { TRADING_PAIRS, SUPPORTED_LANGUAGES } from '../constants';
import { Moon, Sun, Monitor, Bell, Globe, RotateCcw, ShieldCheck, Timer, AlertTriangle } from 'lucide-react';
import { RiskTolerance } from '../types';
import { t } from '../utils';

const Settings: React.FC = () => {
  const { preferences, updatePreferences, togglePair, resetApp } = useAppStore();

  const handleNotificationToggle = async (checked: boolean) => {
    if (checked) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        updatePreferences({ notificationsEnabled: true });
      } else {
        alert('Notification permission was denied.');
        updatePreferences({ notificationsEnabled: false });
      }
    } else {
      updatePreferences({ notificationsEnabled: false });
    }
  };

  return (
    <AppShell title={t('settings', preferences.language)}>
      <div className="space-y-8">
        
        {/* Language */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">{t('language_region', preferences.language)}</h3>
          <div className="grid grid-cols-2 gap-3">
             {SUPPORTED_LANGUAGES.map(lang => (
               <button
                 key={lang.id}
                 onClick={() => updatePreferences({ language: lang.id as any })}
                 className={`p-3 rounded-2xl border flex items-center gap-3 transition-all ${
                   preferences.language === lang.id 
                     ? 'bg-sky-500/10 border-sky-500 text-sky-600' 
                     : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
                 }`}
               >
                 <span className="text-xl">{lang.flag}</span>
                 <span className="font-bold text-sm">{lang.name}</span>
               </button>
             ))}
          </div>
          
          <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <Globe size={20} className="text-slate-400" />
              <span className="text-sm font-bold">{t('timezone', preferences.language)}</span>
            </div>
            <select 
              value={preferences.timezone}
              onChange={(e) => updatePreferences({ timezone: e.target.value })}
              className="bg-transparent text-sm font-bold outline-none border-none text-sky-500 text-right cursor-pointer"
            >
              <option value="UTC">UTC</option>
              <option value="Europe/London">London</option>
              <option value="America/New_York">New York</option>
              <option value="Asia/Tokyo">Tokyo</option>
              <option value={Intl.DateTimeFormat().resolvedOptions().timeZone}>Local (Detected)</option>
            </select>
          </div>
        </section>

        {/* AI & Risk */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">{t('ai_profile', preferences.language)}</h3>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={18} className="text-orange-500" />
              <span className="font-bold text-sm">{t('risk_tolerance', preferences.language)}</span>
            </div>
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
              {(['low', 'medium', 'high'] as RiskTolerance[]).map(level => (
                <button
                  key={level}
                  onClick={() => updatePreferences({ riskTolerance: level })}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                    preferences.riskTolerance === level
                      ? 'bg-white dark:bg-slate-700 text-sky-500 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">{t('alerts', preferences.language)}</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <Bell size={20} className="text-slate-400" />
                <span className="text-sm font-bold">{t('push_notifications', preferences.language)}</span>
              </div>
              <input 
                type="checkbox" 
                checked={preferences.notificationsEnabled}
                onChange={(e) => handleNotificationToggle(e.target.checked)}
                className="w-11 h-6 rounded-full bg-slate-200 appearance-none relative cursor-pointer checked:bg-sky-500 transition-colors after:content-[''] after:absolute after:top-1 after:left-1 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-transform checked:after:translate-x-5"
              />
            </div>

            {preferences.notificationsEnabled && (
              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Timer size={20} className="text-slate-400" />
                      <span className="text-sm font-bold">{t('alert_timing', preferences.language)}</span>
                    </div>
                    <span className="text-xs font-bold text-sky-500">{preferences.notifyMinutesBefore} min before</span>
                 </div>
                 <input 
                   type="range" 
                   min="5" 
                   max="60" 
                   step="5"
                   value={preferences.notifyMinutesBefore}
                   onChange={(e) => updatePreferences({ notifyMinutesBefore: parseInt(e.target.value) })}
                   className="w-full accent-sky-500 h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                 />
              </div>
            )}
          </div>
        </section>

        {/* Pairs */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">{t('trading_instruments', preferences.language)}</h3>
          <div className="flex flex-wrap gap-2">
            {TRADING_PAIRS.map(pair => (
              <button
                key={pair.id}
                onClick={() => togglePair(pair.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                  preferences.selectedPairs.includes(pair.id)
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
                }`}
              >
                {pair.name}
              </button>
            ))}
          </div>
        </section>

        {/* Appearance */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">{t('appearance', preferences.language)}</h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'light', icon: Sun, label: 'Light' },
              { id: 'dark', icon: Moon, label: 'Dark' },
              { id: 'system', icon: Monitor, label: 'System' }
            ].map(theme => (
              <button
                key={theme.id}
                onClick={() => updatePreferences({ theme: theme.id as any })}
                className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${
                  preferences.theme === theme.id 
                    ? 'bg-sky-500/10 border-sky-500 text-sky-600' 
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
                }`}
              >
                <theme.icon size={20} />
                <span className="text-xs font-bold">{theme.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Danger Zone */}
        <section className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <Button variant="danger" fullWidth onClick={() => { if(confirm('Reset all settings?')) resetApp() }}>
            <RotateCcw size={18} className="mr-2" />
            {t('reset_app', preferences.language)}
          </Button>
          <div className="flex justify-center items-center gap-1 opacity-40 text-[10px] font-bold uppercase">
            <ShieldCheck size={12} />
            {t('secure_private', preferences.language)}
          </div>
        </section>
      </div>
    </AppShell>
  );
};

export default Settings;
