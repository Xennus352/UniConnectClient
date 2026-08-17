'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

const STORAGE_KEY = 'uniconnect-theme';

interface ThemeSwitcherProps {
  bare?: boolean;
}

export default function ThemeSwitcher({ bare = false }: ThemeSwitcherProps) {
  const [theme, setTheme] = useState<'ocean-light' | 'ocean-dark'>(
    () => (typeof document !== 'undefined' && document.documentElement.dataset.theme === 'ocean-dark' ? 'ocean-dark' : 'ocean-light')
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const selectTheme = (t: 'ocean-light' | 'ocean-dark') => {
    setTheme(t);
  };

  const options = [
    { value: 'ocean-light' as const, label: 'Cloudy Sky', desc: 'Soft blue daylight', Icon: Sun },
    { value: 'ocean-dark' as const, label: 'Deep Ocean', desc: 'Ocean blue at night', Icon: Moon },
  ];

  const content = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sun size={16} /> Theme Switcher
        </div>
      </div>
      <div style={{ padding: '16px 22px' }}>
        <p style={{ fontSize: 12, color: 'var(--text-lighter)', margin: '0 0 16px 0' }}>
          Choose how UniConnect looks. Changes are applied instantly and saved on this device.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {options.map(({ value, label, desc, Icon }) => {
            const isActive = theme === value;
            return (
              <button
                key={value}
                onClick={() => selectTheme(value)}
                className="flex items-center gap-3 cursor-pointer transition-all duration-200"
                style={{
                  padding: '16px 18px',
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${isActive ? 'var(--primary)' : 'var(--secondary)'}`,
                  background: isActive ? 'rgba(40,114,161,0.08)' : 'var(--secondary-lighter)',
                  boxShadow: isActive ? '0 4px 14px rgba(40,114,161,0.15)' : 'none',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.borderColor = 'var(--primary)'; } }}
                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.borderColor = 'var(--secondary)'; } }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isActive ? 'linear-gradient(var(--primary), var(--primary-dark))' : 'var(--surface)',
                    border: '1px solid var(--surface-border)',
                    color: isActive ? '#fff' : 'var(--primary)',
                  }}
                >
                  <Icon size={18} />
                </div>
                <div className="flex-1">
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--accent)' }}>{label}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-lighter)', marginTop: 1 }}>{desc}</div>
                </div>
                {isActive && (
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: 'var(--primary)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    ✓
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );

  if (bare) {
    return content;
  }

  return (
    <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
      {content}
    </div>
  );
}
