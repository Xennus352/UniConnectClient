'use client';

import { useRef, useCallback, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Toaster } from 'sonner';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import RealtimeAlerts from './RealtimeAlerts';
import { useSession } from './session';
import { MAIN_NAV, type UserRole } from './constants';

interface PageLayoutProps {
  role: UserRole;
  children: React.ReactNode;
}

export default function PageLayout({ role, children }: PageLayoutProps) {
  const drawerRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useSession();

  const basePath = `/${role}`;
  const defaultPage = MAIN_NAV[role][0]?.items[0]?.id ?? 'feed';

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== role) {
      router.replace('/');
    }
  }, [user, role, router, loading]);

  const activePage =
    pathname === basePath ? defaultPage : pathname.split('/').pop() || defaultPage;

  const toggleDrawer = useCallback(() => {
    if (drawerRef.current) drawerRef.current.checked = !drawerRef.current.checked;
  }, []);

  if (loading || !user || user.role !== role) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="drawer lg:drawer-open">
      <input
        id="layout-drawer"
        type="checkbox"
        className="drawer-toggle"
        ref={drawerRef}
        defaultChecked={false}
      />
      <div className="drawer-content flex flex-col min-h-[100dvh]">
        <RealtimeAlerts />
        <Navbar onMenuToggle={toggleDrawer} basePath={basePath} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-7">
          <div className="max-w-[1280px] mx-auto h-full">{children}</div>
        </main>
      </div>
      <div className="drawer-side z-50">
        <label htmlFor="layout-drawer" aria-label="close sidebar" className="drawer-overlay" />
        <Sidebar basePath={basePath} activePage={activePage} role={role} />
      </div>
    </div>
  );
}