'use client';

import PageLayout from '@/components/shared/PageLayout';
import { TimetableSection } from '@/components/student-affairs/sections';

export default function TimetablePage() {
  return (
    <PageLayout role="student-affair">
      <TimetableSection />
    </PageLayout>
  );
}
