'use client';

import { Download } from 'lucide-react';

interface Props {
  height: number;
  progress: number;
  retrying: boolean;
  attemptsLeft: number;
  label?: string;
}

export default function PostImageDownload({ height, progress, retrying, attemptsLeft, label = 'Downloading image…' }: Props) {
  return (
    <div
      className="mt-3 w-full flex flex-col items-center justify-center gap-2"
      style={{ height, borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', background: 'var(--divider-soft)' }}
    >
      <div className="flex items-center gap-1.5" style={{ color: 'var(--text-lighter)', fontSize: 11.5 }}>
        <Download size={13} />
        <span>{retrying ? `Retrying… (${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left)` : label}</span>
      </div>
      <div
        className="w-full max-w-[70%] h-1.5 overflow-hidden"
        style={{ background: 'var(--divider)', borderRadius: 999, border: '1px solid var(--surface-border)' }}
      >
        <div
          className="h-full transition-[width] duration-200 ease-out"
          style={{ width: `${progress}%`, background: 'var(--primary)', borderRadius: 999 }}
        />
      </div>
      <span style={{ color: 'var(--text-lighter)', fontSize: 10.5, fontWeight: 600 }}>{progress}%</span>
    </div>
  );
}