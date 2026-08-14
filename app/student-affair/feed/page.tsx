'use client';

import PageLayout from '@/components/shared/PageLayout';
import { FeedSection } from '@/components/student-affairs/sections';

export default function FeedPage() {
  return (
    <PageLayout role="student-affair">
      <FeedSection />
    </PageLayout>
  );
}
