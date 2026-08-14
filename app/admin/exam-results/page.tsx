'use client';

import PageLayout from '@/components/shared/PageLayout';
import { ExamResultsSection } from '@/components/admin/sections';

export default function ExamResultsPage() {
  return (
    <PageLayout role="admin">
      <ExamResultsSection />
    </PageLayout>
  );
}
