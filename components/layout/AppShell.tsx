
import React, { useMemo } from 'react';
import { Newspaper, Settings, ShieldAlert, Bell, Activity } from 'lucide-react';
import { useAppStore, View } from '../../store';
import { Impact } from '../../types';
import { NO_TRADE_RULES } from '../../constants';

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
}

const AppShell: React.FC<AppShellProps> = ({ children, title = "News Guard" }) => {
  const { news, preferences, currentView, setCurrentView } = useAppStore();

  const isNoTradeDay = useMemo(() => news.some(n => {
    const isHighImpact = n.impact === Impact.HIGH;
    const matchesKeyword = NO_TRADE_RULES.some(rule =>
      preferences.noTradeRules.includes(rule.id) &&
      rule.keywords.some(kw => n.title.toLowerCase().includes(kw.toLowerCase()))
    );
    // Respect AI-detected flag or keyword match for high impact events
    return isHighImpact && (matchesKeyword || n.isNoTrade);
  }), [news, preferences.noTradeRules]);

  const NavItem = ({ view, icon: Icon, label, alert = false }: { view: View, icon: any, label: string, alert?: boolean }) => {
    const isActive = currentView === view;
    return (
      <button
        onClick={() => setCurrentView(view)}
        className={`flex flex-col items-center gap-1 transition-colors relative ${isActive ? 'text-sky-500' : 'text-slate-400'}`}
      >
        <Icon size={24} />
        <span className="text-[10px] font-bold uppercase tracking-tight">{label}</span>
        {alert && <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />}
      </button>
    );
  };

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <header className="sticky top-0 z-50 glass px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center text-white relative">
            <ShieldAlert size={20} />
            {isNoTradeDay && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full animate-ping" />}
          </div>
          <h1 className="font-bold text-lg tracking-tight">{title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative">
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-sky-500 rounded-full" />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 glass border-t border-slate-200 dark:border-slate-800 px-6 py-3 flex justify-around items-center z-50">
        <NavItem view="dashboard" icon={Activity} label="Timeline" />
        <NavItem view="notrade" icon={ShieldAlert} label="Rules" alert={isNoTradeDay} />
        <NavItem view="settings" icon={Settings} label="Config" />
      </nav>
    </div>
  );
};

export default AppShell;
