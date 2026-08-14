'use client';

import PageLayout from '@/components/shared/PageLayout';
import { RollCallSection } from '@/components/student-affairs/sections';

export default function RollCallPage() {
  return (
    <PageLayout role="student-affair">
      <RollCallSection />
    </PageLayout>
  );
}
