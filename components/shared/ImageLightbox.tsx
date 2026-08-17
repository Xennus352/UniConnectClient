'use client';

import { useEffect, useRef } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface ImageLightboxProps {
  open: boolean;
  onClose: () => void;
  src: string;
  postId?: string;
}

function dataUrlMime(src: string): string {
  return (src.match(/^data:([^;]+);/) ?? [])[1] ?? 'image/png';
}

function dataUrlExt(src: string): string {
  const mime = dataUrlMime(src).split('/')[1] ?? 'png';
  return mime.includes('svg') ? 'svg' : mime.split('+')[0] ?? 'png';
}

async function downloadImage(src: string, postId?: string) {
  const blob = await fetch(src).then((r) => r.blob());
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `uniconnect-${postId ?? Date.now()}.${dataUrlExt(src)}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ImageLightbox({ open, onClose, src, postId }: ImageLightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      document.body.style.overflow = 'hidden';
    } else if (!open && el.open) {
      el.close();
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handler = () => { document.body.style.overflow = ''; onClose(); };
    el.addEventListener('close', handler);
    return () => el.removeEventListener('close', handler);
  }, [onClose]);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadImage(src, postId);
    } finally {
      setTimeout(() => setDownloading(false), 600);
    }
  };

  return (
    <>
      <style>{`
        dialog.image-lightbox::backdrop {
          background: rgba(4, 10, 16, 0.72);
          animation: lb-fade 0.25s ease-out;
        }
        dialog.image-lightbox[open] {
          animation: lb-pop 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        dialog.image-lightbox[open] .lb-img {
          animation: lb-zoom 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes lb-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes lb-pop {
          from { opacity: 0; transform: scale(0.92) translateY(10px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes lb-zoom {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
      <dialog
        ref={dialogRef}
        className="image-lightbox"
        style={{
          border: 'none',
          background: 'transparent',
          padding: 0,
          margin: 'auto',
          width: 'min(92vw, 1100px)',
          maxHeight: '88vh',
          overflow: 'hidden',
        }}
      >
        <div
          className="flex flex-col items-center gap-3.5"
          style={{ overflow: 'hidden' }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <div
            className="relative w-full"
            style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: '#0b1220', border: '1px solid var(--surface-border)', boxShadow: '0 32px 80px rgba(0,0,0,0.55)' }}
          >
            <img
              src={src}
              alt=""
              className="lb-img w-full h-auto block"
              style={{ maxHeight: 'calc(88vh - 96px)', objectFit: 'contain', margin: '0 auto' }}
            />
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              aria-label="Close image"
              className="cursor-pointer border-none flex items-center justify-center transition-transform duration-200 hover:scale-110 hover:rotate-90"
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'rgba(8, 15, 23, 0.66)',
                color: '#e8f0f6',
                border: '1px solid rgba(255,255,255,0.18)',
              }}
            >
              <X size={17} />
            </button>
          </div>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="btn btn-sm border-none cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-60"
            style={{
              background: 'var(--primary)',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: 12.5,
              padding: '0 16px',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 6px 18px rgba(40, 114, 161, 0.35)',
              minHeight: 34,
              flexShrink: 0,
            }}
          >
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {downloading ? 'Preparing…' : 'Download image'}
          </button>
        </div>
      </dialog>
    </>
  );
}