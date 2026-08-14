'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, Search, Bell, Settings } from 'lucide-react';
import SearchModal from './SearchModal';
import ThemeToggle from './ThemeToggle';

interface NavbarProps {
  onMenuToggle: () => void;
  basePath: string;
}

export default function Navbar({ onMenuToggle, basePath }: NavbarProps) {
  const [showSearch, setShowSearch] = useState(false);

  const ghostButtonStyle = {
    background: 'linear-gradient(135deg, var(--surface-soft), var(--surface-soft))',
    border: '1.5px solid var(--surface-border)',
    color: 'var(--primary)',
  };

  return (
    <div
      className="h-16 flex items-center justify-between px-4 lg:px-7"
      style={{
        background: 'var(--nav-bg)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--surface-border)',
      }}
    >
      <div className="flex items-center gap-3 flex-1">
        <button
          onClick={onMenuToggle}
          className="btn btn-ghost btn-square lg:hidden"
          style={{ color: 'var(--primary)' }}
        >
          <Menu size={20} />
        </button>
        <button
          onClick={() => setShowSearch(true)}
          className="flex items-center gap-2.5 px-4 py-[9px] rounded-xl w-full lg:w-[380px] transition-all duration-200 cursor-pointer border-none text-left"
          style={{
            background: 'linear-gradient(135deg, var(--surface-soft), var(--surface-soft))',
            border: '1.5px solid var(--surface-border)',
            color: 'var(--text-lighter)',
            fontSize: 14,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(14, 165, 233,0.15)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--surface-border)'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          <Search size={15} />
          <span className="font-medium">Search people, courses...</span>
        </button>
      </div>

      <SearchModal open={showSearch} onClose={() => setShowSearch(false)} />
      <div className="flex items-center gap-3">
        <Link
          href={`${basePath}/notifications`}
          className="relative flex items-center justify-center transition-all duration-200"
          style={ghostButtonStyle}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.background = 'linear-gradient(135deg, var(--primary), var(--primary-dark))';
            el.style.color = 'white';
            el.style.borderColor = 'var(--primary)';
            el.style.transform = 'translateY(-1px)';
            el.style.boxShadow = '0 4px 12px rgba(14, 165, 233,0.3)';
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.background = 'linear-gradient(135deg, var(--surface-soft), var(--surface-soft))';
            el.style.color = 'var(--primary)';
            el.style.borderColor = 'var(--surface-border)';
            el.style.transform = 'translateY(0)';
            el.style.boxShadow = 'none';
          }}
        >
          <Bell size={16} />
          <span
            className="absolute"
            style={{
              top: '7px',
              right: '7px',
              width: '8px',
              height: '8px',
              backgroundColor: 'var(--danger)',
              borderRadius: '50%',
              border: '2px solid var(--modal-bg)',
            }}
          />
        </Link>
        <Link
          href={`${basePath}/settings`}
          className="flex items-center justify-center transition-all duration-200"
          style={ghostButtonStyle}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.background = 'linear-gradient(135deg, var(--primary), var(--primary-dark))';
            el.style.color = 'white';
            el.style.borderColor = 'var(--primary)';
            el.style.transform = 'translateY(-1px)';
            el.style.boxShadow = '0 4px 12px rgba(14, 165, 233,0.3)';
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.background = 'linear-gradient(135deg, var(--surface-soft), var(--surface-soft))';
            el.style.color = 'var(--primary)';
            el.style.borderColor = 'var(--surface-border)';
            el.style.transform = 'translateY(0)';
            el.style.boxShadow = 'none';
          }}
        >
          <Settings size={16} />
        </Link>
        <div
          className="flex items-center justify-center"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--surface-soft), var(--surface-soft))',
            border: '1.5px solid var(--surface-border)',
          }}
        >
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}