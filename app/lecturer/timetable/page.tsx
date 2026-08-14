'use client';

import PageLayout from '@/components/shared/PageLayout';
import { TimetableSection } from '@/components/lecturer/sections';

export default function TimetablePage() {
  return (
    <PageLayout role="lecturer">
      <TimetableSection />
    </PageLayout>
  );
}