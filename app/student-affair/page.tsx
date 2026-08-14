'use client';

import PageLayout from '@/components/shared/PageLayout';
import { Dashboard } from '@/components/student-affairs/sections';

export default function StudentAffairPage() {
  return (
    <PageLayout role="student-affair">
      <Dashboard />
    </PageLayout>
  );
}
