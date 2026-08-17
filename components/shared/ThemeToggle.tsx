'use client';

import { useState } from 'react';
import { Sun, Moon } from 'lucide-react';

const STORAGE_KEY = 'uniconnect-theme';

export default function ThemeToggle() {
  const [dark, setDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.dataset.theme === 'ocean-dark'
  );

  const handleChange = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'ocean-dark' : 'ocean-light';
    localStorage.setItem(STORAGE_KEY, next ? 'ocean-dark' : 'ocean-light');
  };

  return (
    <label className="swap swap-rotate cursor-pointer" aria-label="Toggle theme">
      <input type="checkbox" checked={dark} onChange={handleChange} value="dark" />
      <Sun className="swap-on w-5 h-5 text-base-content" />
      <Moon className="swap-off w-5 h-5 text-base-content" />
    </label>
  );
}
