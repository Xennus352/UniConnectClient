'use client';

import PostTag from './PostTag';

interface ExploreCardProps {
  title: string;
  meta: string;
  description: string;
  tags: { label: string; color: string }[];
}

export default function ExploreCard({ title, meta, description, tags }: ExploreCardProps) {
  return (
    <div
      className="bg-base-100 backdrop-blur-xl p-5 cursor-pointer transition-all duration-300 ease-out hover:-translate-y-[3px] hover:shadow-[var(--shadow-md)] hover:border-base-300"
      style={{
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--surface-border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="flex items-start justify-between mb-[10px]">
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>{title}</h3>
        <span style={{ fontSize: 12, color: 'var(--text-lighter)', fontWeight: 600 }}>{meta}</span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-light)', lineHeight: 1.5, marginBottom: 12 }}>{description}</p>
      <div className="flex gap-[6px] flex-wrap">
        {tags.map((tag, i) => (
          <PostTag key={i} label={tag.label} />
        ))}
      </div>
    </div>
  );
}
