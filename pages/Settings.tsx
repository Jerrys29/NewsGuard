
import React from 'react';
import AppShell from '../components/layout/AppShell';
import { useAppStore } from '../store';
import { Button } from '../components/ui/Button';
import { TRADING_PAIRS } from '../constants';
import { Moon, Sun, Monitor, Bell, Globe, RotateCcw, ShieldCheck } from 'lucide-react';

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
    <AppShell title="Settings">
      <div className="space-y-8">
        {/* Appearance */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Appearance</h3>
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

        {/* Pairs */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Trading Instruments</h3>
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
          <label className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 cursor-pointer">
            <input 
              type="checkbox" 
              checked={preferences.alwaysIncludeUSD}
              onChange={(e) => updatePreferences({ alwaysIncludeUSD: e.target.checked })}
              className="w-5 h-5 rounded-lg border-slate-300 text-sky-500 focus:ring-sky-500"
            />
            <div className="flex-1">
              <p className="text-sm font-bold">Always include USD news</p>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Recommended for all traders</p>
            </div>
          </label>
        </section>

        {/* Notifications */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Notifications</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <Bell size={20} className="text-slate-400" />
                <span className="text-sm font-bold">Push Notifications</span>
              </div>
              <input 
                type="checkbox" 
                checked={preferences.notificationsEnabled}
                onChange={(e) => handleNotificationToggle(e.target.checked)}
                className="w-11 h-6 rounded-full bg-slate-200 appearance-none relative cursor-pointer checked:bg-sky-500 transition-colors after:content-[''] after:absolute after:top-1 after:left-1 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-transform checked:after:translate-x-5"
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <Globe size={20} className="text-slate-400" />
                <span className="text-sm font-bold">Timezone</span>
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
          </div>
        </section>

        {/* Danger Zone */}
        <section className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <Button variant="danger" fullWidth onClick={() => { if(confirm('Reset all settings?')) resetApp() }}>
            <RotateCcw size={18} className="mr-2" />
            Reset Application
          </Button>
          <div className="flex justify-center items-center gap-1 opacity-40 text-[10px] font-bold uppercase">
            <ShieldCheck size={12} />
            Secure & Private · No Data Stored Online
          </div>
        </section>
      </div>
    </AppShell>
  );
};

export default Settings;
