'use client';

import PageLayout from '@/components/shared/PageLayout';
import { LostFoundSection } from '@/components/student-affairs/sections';

export default function LostFoundPage() {
  return (
    <PageLayout role="student-affair">
      <LostFoundSection />
    </PageLayout>
  );
}
