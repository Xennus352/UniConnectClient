'use client';

import PageLayout from '@/components/shared/PageLayout';
import { FeedSection } from '@/components/student/sections';

export default function StudentPage() {
  return (
    <PageLayout role="student">
      <FeedSection />
    </PageLayout>
  );
}
