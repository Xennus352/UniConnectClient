'use client';

import PageLayout from '@/components/shared/PageLayout';
import { TimetableSection } from '@/components/student/sections';

export default function TimetablePage() {
  return (
    <PageLayout role="student">
      <TimetableSection />
    </PageLayout>
  );
}
