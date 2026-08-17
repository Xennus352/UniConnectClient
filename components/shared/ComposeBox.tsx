'use client';

import { Paperclip, Image, Tag, Send } from 'lucide-react';

interface ComposeBoxProps {
  placeholder?: string;
  avatarInitials?: string;
}

export default function ComposeBox({ placeholder = 'Share an update with your university...', avatarInitials = 'MK' }: ComposeBoxProps) {
  return (
    <div
      className="bg-base-100 backdrop-blur-xl p-[18px] mb-[18px]"
      style={{
        borderRadius: 'var(--radius-lg)',
        border: '1.5px solid var(--surface-strong)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: 'linear-gradient(to bottom right, #cbdde9, #cbdde9)',
            color: 'var(--primary)',
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {avatarInitials}
        </div>
        <textarea
          className="flex-1 outline-none resize-none p-3 px-4"
          placeholder={placeholder}
          style={{
            border: 'none',
            backgroundColor: 'var(--secondary-lighter)',
            borderRadius: 'var(--radius-md)',
            fontSize: 14,
            height: 48,
            color: 'var(--text)',
            fontFamily: 'inherit',
            transition: 'all 0.2s ease',
          }}
          onFocus={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--secondary-light)';
            e.currentTarget.style.boxShadow = 'inset 0 0 0 2px var(--secondary)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--secondary-lighter)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>
      <div
        className="flex items-center justify-between mt-3 pt-3"
        style={{ borderTop: '1px solid var(--surface)' }}
      >
        <div className="flex gap-2">
          <button
            className="flex items-center gap-[5px] px-[13px] py-[7px] cursor-pointer font-medium transition-all"
            style={{
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--secondary-lighter)',
              border: '1.5px solid var(--secondary)',
              fontSize: 13,
              color: 'var(--text-light)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--secondary-light)';
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.color = 'var(--primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--secondary-lighter)';
              e.currentTarget.style.borderColor = 'var(--secondary)';
              e.currentTarget.style.color = 'var(--text-light)';
            }}
          >
            <Paperclip size={13} /> Attach
          </button>
          <button
            className="flex items-center gap-[5px] px-[13px] py-[7px] cursor-pointer font-medium transition-all"
            style={{
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--secondary-lighter)',
              border: '1.5px solid var(--secondary)',
              fontSize: 13,
              color: 'var(--text-light)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--secondary-light)';
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.color = 'var(--primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--secondary-lighter)';
              e.currentTarget.style.borderColor = 'var(--secondary)';
              e.currentTarget.style.color = 'var(--text-light)';
            }}
          >
            <Image size={13} /> Photo
          </button>
          <button
            className="flex items-center gap-[5px] px-[13px] py-[7px] cursor-pointer font-medium transition-all"
            style={{
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--secondary-lighter)',
              border: '1.5px solid var(--secondary)',
              fontSize: 13,
              color: 'var(--text-light)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--secondary-light)';
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.color = 'var(--primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--secondary-lighter)';
              e.currentTarget.style.borderColor = 'var(--secondary)';
              e.currentTarget.style.color = 'var(--text-light)';
            }}
          >
            <Tag size={13} /> Tag
          </button>
        </div>
        <button
          className="flex items-center gap-[5px] px-[14px] py-[7px] cursor-pointer font-semibold border-none"
          style={{
            borderRadius: 'var(--radius-sm)',
            background: 'linear-gradient(var(--primary), var(--primary-dark))',
            color: '#fff',
            fontSize: 13,
            boxShadow: '0 2px 8px rgba(35, 96, 138,0.25)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(35, 96, 138,0.35)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(35, 96, 138,0.25)';
          }}
        >
          <Send size={14} /> Post
        </button>
      </div>
    </div>
  );
}
