'use client';

import PageLayout from '@/components/shared/PageLayout';
import { ExamResultsSection } from '@/components/student/sections';

export default function ExamResultsPage() {
  return (
    <PageLayout role="student">
      <ExamResultsSection />
    </PageLayout>
  );
}
