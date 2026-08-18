'use client';

import PageLayout from '@/components/shared/PageLayout';
import { ActivitySection } from '@/components/student-affairs/sections';

export default function ActivityPage() {
  return (
    <PageLayout role="student-affair">
      <ActivitySection />
    </PageLayout>
  );
}
