'use client';

import PageLayout from '@/components/shared/PageLayout';
import { RollCallSection } from '@/components/student/sections';

export default function RollCallPage() {
  return (
    <PageLayout role="student">
      <RollCallSection />
    </PageLayout>
  );
}
