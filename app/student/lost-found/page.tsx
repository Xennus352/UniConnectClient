'use client';

import PageLayout from '@/components/shared/PageLayout';
import { LostFoundSection } from '@/components/student/sections';

export default function LostFoundPage() {
  return (
    <PageLayout role="student">
      <LostFoundSection />
    </PageLayout>
  );
}
