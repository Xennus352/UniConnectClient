'use client';

import PageLayout from '@/components/shared/PageLayout';
import { TimetableGenerationSection } from '@/components/lecturer/sections';

export default function TimetableGenerationPage() {
  return (
    <PageLayout role="lecturer">
      <TimetableGenerationSection />
    </PageLayout>
  );
}
