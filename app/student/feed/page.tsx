'use client';

import PageLayout from '@/components/shared/PageLayout';
import { FeedSection } from '@/components/student/sections';

export default function FeedPage() {
  return (
    <PageLayout role="student">
      <FeedSection />
    </PageLayout>
  );
}
