'use client';

import { useEffect, useState } from 'react';

interface WelcomeBarProps {
  name: string;
  subtitle?: string;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Good night';
}

function formatTime(): string {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export default function WelcomeBar({ name, subtitle }: WelcomeBarProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const day = now.getDate();
  const month = now.toLocaleString('default', { month: 'long' });
  const year = now.getFullYear();
  const time = formatTime();
  const greeting = getGreeting();

  return (
<div
      className="relative overflow-hidden flex items-center justify-between flex-col sm:flex-row p-6 lg:p-8 mb-5 bg-base-100 backdrop-blur-2xl"
      style={{
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--surface-border)',
        color: 'var(--text)',
        boxShadow: 'var(--shadow-sm), inset 0 1px 0 var(--surface-soft)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(14, 165, 233,0.1) 0%, rgba(42,122,170,0.05) 50%, transparent 100%)',
          borderRadius: 'var(--radius-xl)',
          pointerEvents: 'none',
        }}
      />
      <div className="relative z-10">
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px', margin: 0 }}>
          {greeting}, {name}!
        </h1>
        {subtitle && (
          <p style={{ marginTop: 6, opacity: 0.85, fontSize: 14, fontWeight: 400 }}>
            {subtitle}
          </p>
        )}
      </div>
      <div className="relative z-10 text-right">
        <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1 }}>{day}</div>
        <div style={{ fontSize: 13, opacity: 0.8, fontWeight: 500, marginTop: 4 }}>
          {month} {year} &middot; {time}
        </div>
      </div>
    </div>
  );
}
