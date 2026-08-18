'use client';

import PageLayout from '@/components/shared/PageLayout';
import { ActivitySection } from '@/components/student/sections';

export default function ActivityPage() {
  return (
    <PageLayout role="student">
      <ActivitySection />
    </PageLayout>
  );
}
