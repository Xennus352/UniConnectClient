'use client';

import { FileText, ClipboardCheck, CalendarDays, Coins } from 'lucide-react';

export default function QuickAccess() {
  const items = [
    { icon: FileText, label: 'Exam Results' },
    { icon: ClipboardCheck, label: 'Roll Call' },
    { icon: CalendarDays, label: 'Timetable' },
    { icon: Coins, label: 'Finance' },
  ];

  return (
    <div className="grid grid-cols-2 gap-[10px]">
      {items.map((item) => (
        <div
          key={item.label}
          className="text-center cursor-pointer transition-all p-[14px] backdrop-blur-lg"
          style={{
            background: 'var(--divider)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--surface-border)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(40,114,161,0.1)';
            e.currentTarget.style.borderColor = 'var(--secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.borderColor = 'rgba(58,139,194,0.4)';
          }}
        >
          <div className="mb-[6px]" style={{ fontSize: 22, color: 'var(--primary)' }}>
            <item.icon size={20} />
          </div>
          <span className="block" style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
