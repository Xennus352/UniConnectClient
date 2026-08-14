'use client';

import type { ReactNode } from 'react';

interface StatCardProps {
  icon: ReactNode;
  iconBgClass?: string;
  value: string | number;
  label: string;
  trend?: string;
  extra?: string;
}

export default function StatCard({ icon, iconBgClass = '', value, label, trend, extra }: StatCardProps) {
  return (
    <div
      className="bg-base-100 backdrop-blur-xl p-5 cursor-pointer transition-all duration-300 ease-out hover:-translate-y-[3px] hover:shadow-[var(--shadow-md)] hover:border-base-300"
      style={{
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--surface-strong)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className={`w-11 h-11 rounded-[var(--radius-md)] flex items-center justify-center text-lg ${iconBgClass}`}
          style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
        >
          {icon}
        </div>
        {trend && (
          <span
            className="text-[11px] font-bold px-2 py-1 rounded-full"
            style={{ color: 'var(--success)', backgroundColor: 'rgba(34,197,94,0.15)' }}
          >
            {trend}
          </span>
        )}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.5px' }}>{value}</div>
      <div className="mt-[3px]" style={{ fontSize: 13, color: 'var(--text-light)', fontWeight: 500 }}>{label}</div>
      {extra && (
        <div className="mt-1" style={{ fontSize: 12, color: 'var(--text-lighter)', fontWeight: 500 }}>{extra}</div>
      )}
    </div>
  );
}
