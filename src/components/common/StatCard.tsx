import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  trend?: {
    type: 'up' | 'down' | 'neutral';
    text: string;
  };
  color?: 'blue' | 'emerald' | 'amber' | 'rose' | 'purple';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtext,
  icon: Icon,
  trend,
  color = 'blue'
}) => {
  const colorMap = {
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
    rose: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  };

  const style = colorMap[color];

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-lg transition-all hover:border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</span>
        <div className={`p-2.5 rounded-xl ${style.bg} ${style.text} ${style.border} border`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="flex items-baseline justify-between">
        <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
        {trend && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
            trend.type === 'up' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
            trend.type === 'down' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
            'bg-slate-800 text-slate-300 border border-slate-700'
          }`}>
            {trend.text}
          </span>
        )}
      </div>

      {subtext && (
        <p className="text-xs text-slate-400 mt-1 font-medium">{subtext}</p>
      )}
    </div>
  );
};
