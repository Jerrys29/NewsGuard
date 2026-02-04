
import React from 'react';
import AppShell from '../components/layout/AppShell';
import { useAppStore } from '../store';
import { NO_TRADE_RULES } from '../constants';
import { Badge } from '../components/ui/Badge';
import { AlertTriangle, Info } from 'lucide-react';
import { t } from '../utils';

const NoTradeConfigPage: React.FC = () => {
  const { preferences, updatePreferences } = useAppStore();

  const toggleRule = (ruleId: string) => {
    const rules = preferences.noTradeRules.includes(ruleId)
      ? preferences.noTradeRules.filter(id => id !== ruleId)
      : [...preferences.noTradeRules, ruleId];
    updatePreferences({ noTradeRules: rules });
  };

  return (
    <AppShell title="No-Trade Rules">
      <div className="space-y-6">
        <div className="p-5 rounded-2xl bg-sky-500 text-white space-y-2">
          <div className="flex items-center gap-2">
            <Info size={20} />
            <h2 className="font-bold">{t('what_is_notrade', preferences.language)}</h2>
          </div>
          <p className="text-sm opacity-90 leading-relaxed">
            {t('notrade_desc', preferences.language)}
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 px-1">{t('active_rules', preferences.language)}</h3>
          <div className="space-y-3">
            {NO_TRADE_RULES.map(rule => (
              <button
                key={rule.id}
                onClick={() => toggleRule(rule.id)}
                className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start gap-4 ${
                  preferences.noTradeRules.includes(rule.id)
                    ? 'bg-white dark:bg-slate-900 border-sky-500 ring-1 ring-sky-500/20'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60'
                }`}
              >
                <div className={`mt-1 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  rule.volatility === 3 ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'
                }`}>
                  <AlertTriangle size={18} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold">{rule.id}</span>
                    <Badge variant={rule.volatility === 3 ? 'danger' : 'warning'}>
                      {'⚠️'.repeat(rule.volatility)}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{rule.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default NoTradeConfigPage;
