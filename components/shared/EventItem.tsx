'use client';

interface EventItemProps {
  day: string;
  month: string;
  title: string;
  description: string;
  action: string;
}

export default function EventItem({ day, month, title, description, action }: EventItemProps) {
  return (
    <div
      className="flex items-center gap-[14px] px-[22px] py-[14px] cursor-pointer transition-all last:[border-bottom:none] hover:bg-[var(--surface-soft)]"
      style={{ borderBottom: '1px solid var(--divider)' }}
    >
      <div
        className="w-12 h-12 flex flex-col items-center justify-center shrink-0"
        style={{
          background: 'var(--divider)',
          borderRadius: 'var(--radius-md)',
          border: '1.5px solid var(--surface-border)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>{day}</div>
        <div className="mt-[2px]" style={{ fontSize: 10, color: 'var(--text-light)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{month}</div>
      </div>
      <div className="flex-1 min-w-0">
        <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>{title}</h4>
        <p className="mt-[3px]" style={{ fontSize: 12, color: 'var(--text-light)', fontWeight: 500 }}>{description}</p>
      </div>
      <button
        className="border-none cursor-pointer"
        style={{
          padding: '6px 14px',
          borderRadius: 'var(--radius-sm)',
          background: 'linear-gradient(var(--primary), var(--primary-dark))',
          color: '#fff',
          fontSize: 12,
          fontWeight: 600,
          boxShadow: '0 2px 8px rgba(40,114,161,0.25)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = '0 4px 14px rgba(40,114,161,0.35)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(40,114,161,0.25)';
        }}
      >
        {action}
      </button>
    </div>
  );
}
