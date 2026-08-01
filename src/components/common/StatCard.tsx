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
    blue: 'text-blue-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    rose: 'text-rose-400',
    purple: 'text-purple-400',
  };

  const textColor = colorMap[color];

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-5 shadow-sm transition-all hover:border-slate-700 hover:bg-slate-900 group">
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase block mb-1">{title}</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">{value}</span>
          </div>
        </div>
        <div className={`p-2 rounded-xl bg-slate-950/50 border border-slate-800/50 ${textColor} group-hover:scale-105 transition-transform`}>
          <Icon className="w-4 h-4" strokeWidth={2.5} />
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 mt-2">
        {subtext ? (
          <p className="text-[10px] text-slate-400 font-medium">{subtext}</p>
        ) : <div />}
        
        {trend && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
            trend.type === 'up' ? 'text-emerald-400 bg-emerald-500/10' :
            trend.type === 'down' ? 'text-rose-400 bg-rose-500/10' :
            'text-slate-400 bg-slate-800/50'
          }`}>
            {trend.text}
          </span>
        )}
      </div>
    </div>
  );
};
