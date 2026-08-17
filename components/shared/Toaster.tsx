'use client';

import { useEffect, useState } from 'react';
import { Toaster as SonnerToaster } from 'sonner';

export default function Toaster() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const update = () =>
      setTheme(document.documentElement.dataset.theme === 'ocean-dark' ? 'dark' : 'light');
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  return <SonnerToaster theme={theme} richColors closeButton position="top-center" />;
}