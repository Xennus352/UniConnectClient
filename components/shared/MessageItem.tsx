'use client';

interface MessageItemProps {
  initials: string;
  color: string;
  name: string;
  preview: string;
  time: string;
  unread?: boolean;
}

export default function MessageItem({ initials, color, name, preview, time, unread }: MessageItemProps) {
  return (
    <div
      className="flex items-center gap-3 px-[22px] py-3 cursor-pointer transition-all last:[border-bottom:none] hover:bg-[var(--divider-soft)]"
      style={{ borderBottom: '1px solid var(--surface-soft)' }}
    >
      <div
        className={`w-[38px] h-[38px] rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white font-bold shrink-0`}
        style={{ fontSize: 12 }}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{name}</span>
          <span style={{ fontSize: 11.5, color: 'var(--text-lighter)', fontWeight: 500 }}>{time}</span>
        </div>
        <div
          className="mt-[2px] whitespace-nowrap overflow-hidden"
          style={{ fontSize: 13, color: 'var(--text-light)', textOverflow: 'ellipsis' }}
        >
          {preview}
        </div>
      </div>
      {unread && (
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: 'var(--primary)', boxShadow: '0 0 6px rgba(2, 132, 199,0.3)' }}
        />
      )}
    </div>
  );
}
