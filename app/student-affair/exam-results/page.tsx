'use client';

import PageLayout from '@/components/shared/PageLayout';
import { ExamResultsSection } from '@/components/student-affairs/sections';

export default function ExamResultsPage() {
  return (
    <PageLayout role="student-affair">
      <ExamResultsSection />
    </PageLayout>
  );
}