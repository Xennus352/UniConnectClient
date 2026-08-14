'use client';

import PageLayout from '@/components/shared/PageLayout';
import { ExamResultsSection } from '@/components/lecturer/sections';

export default function ExamResultsPage() {
  return (
    <PageLayout role="lecturer">
      <ExamResultsSection />
    </PageLayout>
  );
}