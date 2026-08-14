'use client';

import { Star, Trash2 } from 'lucide-react';
import type { InboxItemData } from './types';

interface InboxItemProps {
  item: InboxItemData;
  onToggleStar?: (id: string) => void;
  onDelete?: (id: string) => void;
  onClick?: (item: InboxItemData) => void;
}

export default function InboxItem({ item, onToggleStar, onDelete, onClick }: InboxItemProps) {
  return (
    <div
      onClick={() => onClick?.(item)}
      className={`group flex items-start gap-[14px] px-[22px] py-4 cursor-pointer transition-all last:[border-bottom:none] hover:bg-[var(--divider-soft)] ${item.unread ? 'bg-[rgba(58,139,194,0.15)]' : ''}`}
      style={{ borderBottom: '1px solid var(--divider)' }}
    >
      <div
        className={`w-[42px] h-[42px] rounded-full bg-gradient-to-br ${item.sender.color} flex items-center justify-center text-white font-bold shrink-0`}
        style={{ fontSize: 14 }}
      >
        {item.sender.initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{item.sender.name}</span>
          <span className="flex items-center gap-2">
            <span style={{ fontSize: 12, color: 'var(--text-lighter)', fontWeight: 500 }}>{item.time}</span>
            <span className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); onToggleStar?.(item.id); }}
                className="flex items-center justify-center transition-all"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  backgroundColor: 'var(--secondary-lighter)',
                  border: '1px solid var(--secondary)',
                  color: item.starred ? 'var(--warning)' : 'var(--text-light)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--secondary)';
                  e.currentTarget.style.color = 'var(--primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--secondary-lighter)';
                  e.currentTarget.style.color = item.starred ? 'var(--warning)' : 'var(--text-light)';
                }}
              >
                <Star size={12} fill={item.starred ? 'currentColor' : 'none'} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete?.(item.id); }}
                className="flex items-center justify-center transition-all"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  backgroundColor: 'var(--secondary-lighter)',
                  border: '1px solid var(--secondary)',
                  color: 'var(--text-light)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--secondary)';
                  e.currentTarget.style.color = 'var(--primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--secondary-lighter)';
                  e.currentTarget.style.color = 'var(--text-light)';
                }}
              >
                <Trash2 size={12} />
              </button>
            </span>
          </span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginTop: 2 }}>{item.subject}</div>
        <div className="mt-[3px] truncate" style={{ fontSize: 13, color: 'var(--text-light)' }}>{item.preview}</div>
      </div>
    </div>
  );
}
