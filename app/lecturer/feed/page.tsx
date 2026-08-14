'use client';

import PageLayout from '@/components/shared/PageLayout';
import { FeedSection } from '@/components/lecturer/sections';

export default function FeedPage() {
  return (
    <PageLayout role="lecturer">
      <FeedSection />
    </PageLayout>
  );
}