'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, Search, Bell, Settings } from 'lucide-react';
import SearchModal from './SearchModal';
import ThemeToggle from './ThemeToggle';
import { useSupabase } from '@/utils/supabase/client';
import { useNotifications } from '@/lib/supabase/hooks';
import { useSession } from './session';

interface NavbarProps {
  onMenuToggle: () => void;
  basePath: string;
}

export default function Navbar({ onMenuToggle, basePath }: NavbarProps) {
  const [showSearch, setShowSearch] = useState(false);

  const { user: session } = useSession();
  const supabase = useSupabase();
  const me = session?.email ?? '';
  const myRole = session?.role ?? '';
  const { notifications } = useNotifications(supabase, me, myRole);
  const unreadCount = (notifications ?? []).filter((n) => !n.read).length;

  const ghostButtonStyle = {
    background: 'linear-gradient(135deg, var(--surface-soft), var(--surface-soft))',
    border: '1.5px solid var(--surface-border)',
    color: 'var(--primary)',
  };

  const iconBtnStyle = {
    width: 38,
    height: 38,
    borderRadius: 10,
    ...ghostButtonStyle,
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
          style={iconBtnStyle}
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
          <Bell size={20} className={unreadCount > 0 ? 'bell-shake' : undefined} />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                minWidth: 17,
                height: 17,
                padding: '0 4px',
                borderRadius: 9,
                backgroundColor: '#ef4444',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid var(--modal-bg)',
                boxSizing: 'border-box',
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
        <Link
          href={`${basePath}/settings`}
          className="flex items-center justify-center transition-all duration-200"
          style={iconBtnStyle}
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
          <Settings size={20} />
        </Link>
        <div
          className="flex items-center justify-center"
          style={iconBtnStyle}
        >
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}