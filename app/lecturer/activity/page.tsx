'use client';

import PageLayout from '@/components/shared/PageLayout';
import { ActivitySection } from '@/components/lecturer/sections';

export default function ActivityPage() {
  return (
    <PageLayout role="lecturer">
      <ActivitySection />
    </PageLayout>
  );
}
