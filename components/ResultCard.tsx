import React from 'react';

interface ResultCardProps {
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const ResultCard: React.FC<ResultCardProps> = ({ title, children, icon, className = "" }) => {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden transition-all duration-300 hover:shadow-md ${className}`}>
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
        {icon && <span className="text-primary-600 dark:text-primary-400">{icon}</span>}
        <h3 className="text-lg font-semibold text-slate-800 dark:text-white">{title}</h3>
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
};
