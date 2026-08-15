import { memo } from 'react';

export const TAG_COLOR_VARS: Record<string, { bg: string; text: string; border: string }> = {
  Event: { bg: 'var(--tag-event-bg)', text: 'var(--tag-event-text)', border: 'var(--tag-event-border)' },
  General: { bg: 'var(--tag-general-bg)', text: 'var(--tag-general-text)', border: 'var(--tag-general-border)' },
  'Lost & Found': { bg: 'var(--tag-lost-bg)', text: 'var(--tag-lost-text)', border: 'var(--tag-lost-border)' },
  Announcement: { bg: 'var(--tag-announcement-bg)', text: 'var(--tag-announcement-text)', border: 'var(--tag-announcement-border)' },
};

interface PostTagProps {
  label: string;
  emoji?: string;
  size?: 'sm' | 'md';
}

export default memo(function PostTag({ label, emoji, size = 'sm' }: PostTagProps) {
  const c =
    TAG_COLOR_VARS[label] ?? {
      bg: 'var(--divider)',
      text: 'var(--text-light)',
      border: 'var(--surface-border)',
    };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: size === 'md' ? '5px 13px' : '3px 9px',
        borderRadius: 999,
        fontSize: size === 'md' ? 13 : 11.5,
        fontWeight: 700,
        letterSpacing: 0.2,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
      }}
    >
      {emoji && <span aria-hidden>{emoji}</span>}
      {label}
    </span>
  );
});
